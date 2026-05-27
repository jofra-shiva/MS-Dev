import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:firebase_auth/firebase_auth.dart';

// ─── Data Models ────────────────────────────────────────────────────────────

class ParticipantDetail {
  final String displayName;
  final String photoURL;
  final String email;

  ParticipantDetail({
    required this.displayName,
    required this.photoURL,
    required this.email,
  });

  factory ParticipantDetail.fromMap(Map<String, dynamic> m) => ParticipantDetail(
        displayName: m['displayName'] ?? '',
        photoURL: m['photoURL'] ?? '',
        email: m['email'] ?? '',
      );

  Map<String, dynamic> toMap() => {
        'displayName': displayName,
        'photoURL': photoURL,
        'email': email,
      };
}

class LastMessage {
  final String text;
  final String senderId;
  final DateTime createdAt;

  LastMessage({required this.text, required this.senderId, required this.createdAt});

  factory LastMessage.fromMap(Map<String, dynamic> m) => LastMessage(
        text: m['text'] ?? '',
        senderId: m['senderId'] ?? '',
        createdAt: (m['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      );
}

class ChatModel {
  final String id;
  final String type; // 'direct' | 'group'
  final String? name;
  final String? projectId;
  final List<String> participants;
  final Map<String, ParticipantDetail> participantDetails;
  final LastMessage? lastMessage;
  final Map<String, int> unreadCounts;
  final DateTime createdAt;
  final DateTime updatedAt;

  ChatModel({
    required this.id,
    required this.type,
    this.name,
    this.projectId,
    required this.participants,
    required this.participantDetails,
    this.lastMessage,
    required this.unreadCounts,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ChatModel.fromDoc(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    final rawDetails = d['participantDetails'] as Map<String, dynamic>? ?? {};
    final rawUnread = d['unreadCounts'] as Map<String, dynamic>? ?? {};

    return ChatModel(
      id: doc.id,
      type: d['type'] ?? 'direct',
      name: d['name'],
      projectId: d['projectId'],
      participants: List<String>.from(d['participants'] ?? []),
      participantDetails: rawDetails.map(
        (k, v) => MapEntry(k, ParticipantDetail.fromMap(Map<String, dynamic>.from(v))),
      ),
      lastMessage: d['lastMessage'] != null
          ? LastMessage.fromMap(Map<String, dynamic>.from(d['lastMessage']))
          : null,
      unreadCounts: rawUnread.map((k, v) => MapEntry(k, (v as num).toInt())),
      createdAt: (d['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (d['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  ParticipantDetail? getOtherParticipant(String myUid) {
    final otherId = participants.firstWhere((p) => p != myUid, orElse: () => '');
    return participantDetails[otherId];
  }

  String displayName(String myUid) {
    if (type == 'group') return name ?? 'Group Chat';
    return getOtherParticipant(myUid)?.displayName ?? 'Unknown';
  }

  String displayPhoto(String myUid) {
    if (type == 'group') return '';
    return getOtherParticipant(myUid)?.photoURL ?? '';
  }

  int unreadFor(String uid) => unreadCounts[uid] ?? 0;
}

class ChatMessage {
  final String id;
  final String chatId;
  final String senderId;
  final String text;
  final String? mediaUrl;
  final String? mediaType; // 'image' | 'audio' | 'file'
  final List<String> readBy;
  final bool isDeleted;
  final bool isEdited;
  final bool isSystem;
  final DateTime createdAt;

  ChatMessage({
    required this.id,
    required this.chatId,
    required this.senderId,
    required this.text,
    this.mediaUrl,
    this.mediaType,
    required this.readBy,
    required this.isDeleted,
    required this.isEdited,
    required this.isSystem,
    required this.createdAt,
  });

  factory ChatMessage.fromDoc(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return ChatMessage(
      id: doc.id,
      chatId: d['chatId'] ?? '',
      senderId: d['senderId'] ?? '',
      text: d['text'] ?? '',
      mediaUrl: d['mediaUrl'],
      mediaType: d['mediaType'],
      readBy: List<String>.from(d['readBy'] ?? []),
      isDeleted: d['isDeleted'] ?? false,
      isEdited: d['isEdited'] ?? false,
      isSystem: d['isSystem'] ?? false,
      createdAt: (d['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  bool get isMine => senderId == FirebaseAuth.instance.currentUser?.uid;
}

// ─── Reply Parser ────────────────────────────────────────────────────────────

class ParsedReply {
  final String replyName;
  final String quotedText;
  final String actualText;
  ParsedReply({required this.replyName, required this.quotedText, required this.actualText});
}

ParsedReply? parseReply(String text) {
  final re = RegExp(r'^> Replying to ([^:]+):\n> ([^\n]*)\n\n([\s\S]*)$');
  final m = re.firstMatch(text);
  if (m == null) return null;
  return ParsedReply(
    replyName: m.group(1) ?? '',
    quotedText: m.group(2) ?? '',
    actualText: m.group(3) ?? '',
  );
}

// ─── Chat Service ────────────────────────────────────────────────────────────

class ChatService {
  static final _db = FirebaseFirestore.instance;
  static final _storage = FirebaseStorage.instance;

  /// Subscribe to all chats this user is part of
  static Stream<List<ChatModel>> subscribeToUserChats(String userId) {
    return _db
        .collection('chats')
        .where('participants', arrayContains: userId)
        .orderBy('updatedAt', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map(ChatModel.fromDoc).toList());
  }

  /// Subscribe to messages in a chat
  static Stream<List<ChatMessage>> subscribeToChatMessages(String chatId) {
    return _db
        .collection('chats/$chatId/messages')
        .orderBy('createdAt', descending: false)
        .snapshots()
        .map((snap) => snap.docs.map(ChatMessage.fromDoc).toList());
  }

  /// Start or get existing direct chat
  static Future<String> startDirectChat({
    required String myUid,
    required String myName,
    required String myPhoto,
    required String myEmail,
    required String targetUid,
    required String targetName,
    required String targetPhoto,
    required String targetEmail,
  }) async {
    // Check if existing direct chat
    final snap = await _db
        .collection('chats')
        .where('type', isEqualTo: 'direct')
        .where('participants', arrayContains: myUid)
        .get();

    final existing = snap.docs.firstWhere(
      (d) => (d.data()['participants'] as List).contains(targetUid),
      orElse: () => throw StateError('not found'),
    );

    try {
      return existing.id;
    } catch (_) {
      // Create new
      final chatRef = _db.collection('chats').doc();
      await chatRef.set({
        'id': chatRef.id,
        'type': 'direct',
        'participants': [myUid, targetUid],
        'participantDetails': {
          myUid: {'displayName': myName, 'photoURL': myPhoto, 'email': myEmail},
          targetUid: {'displayName': targetName, 'photoURL': targetPhoto, 'email': targetEmail},
        },
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return chatRef.id;
    }
  }

  /// Sync group chats for user's projects
  static Future<void> syncProjectGroupChats(List<Map<String, dynamic>> projects) async {
    for (final project in projects) {
      final projectId = project['id'] as String?;
      if (projectId == null) continue;

      final members = project['members'] as Map<String, dynamic>? ?? {};
      final memberUids = members.keys.toList();
      final participantDetails = <String, dynamic>{};

      for (final uid in memberUids) {
        final m = members[uid] as Map<String, dynamic>? ?? {};
        participantDetails[uid] = {
          'displayName': m['displayName'] ?? '',
          'photoURL': m['photoURL'] ?? '',
          'email': m['email'] ?? '',
        };
      }

      final chatId = 'project_$projectId';
      final chatRef = _db.doc('chats/$chatId');
      final snap = await chatRef.get();

      if (!snap.exists) {
        await chatRef.set({
          'id': chatId,
          'type': 'group',
          'projectId': projectId,
          'name': '${project['name']} Team',
          'participants': memberUids,
          'participantDetails': participantDetails,
          'createdAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        });
      } else {
        final existing = snap.data()!;
        final currentParticipants = List<String>.from(existing['participants'] ?? []);
        final merged = {...currentParticipants, ...memberUids}.toList();
        await chatRef.update({
          'participants': merged,
          'participantDetails': {
            ...(existing['participantDetails'] as Map<String, dynamic>? ?? {}),
            ...participantDetails
          },
          'name': '${project['name']} Team',
        });
      }
    }
  }

  /// Send a text message
  static Future<void> sendMessage({
    required String chatId,
    required String senderId,
    required String text,
    String? mediaUrl,
    String? mediaType,
  }) async {
    final messagesRef = _db.collection('chats/$chatId/messages');
    await messagesRef.add({
      'chatId': chatId,
      'senderId': senderId,
      'text': text,
      if (mediaUrl != null) 'mediaUrl': mediaUrl,
      if (mediaType != null) 'mediaType': mediaType,
      'readBy': [senderId],
      'createdAt': FieldValue.serverTimestamp(),
    });

    final chatRef = _db.doc('chats/$chatId');
    final chatSnap = await chatRef.get();
    if (chatSnap.exists) {
      final participants = List<String>.from(chatSnap.data()?['participants'] ?? []);
      final updates = <String, dynamic>{
        'lastMessage': {
          'text': text.trim(),
          'senderId': senderId,
          'createdAt': FieldValue.serverTimestamp(),
        },
        'updatedAt': FieldValue.serverTimestamp(),
      };
      for (final p in participants) {
        if (p != senderId) {
          updates['unreadCounts.$p'] = FieldValue.increment(1);
        }
      }
      await chatRef.update(updates);
    }
  }

  /// Edit a message
  static Future<void> editMessage(String chatId, String messageId, String newText) async {
    await _db.doc('chats/$chatId/messages/$messageId').update({
      'text': newText,
      'isEdited': true,
    });
  }

  /// Soft-delete a message
  static Future<void> deleteMessage(String chatId, String messageId) async {
    await _db.doc('chats/$chatId/messages/$messageId').update({
      'isDeleted': true,
      'text': '',
    });
  }

  /// Mark chat as read for user
  static Future<void> markChatAsRead(String chatId, String userId) async {
    await _db.doc('chats/$chatId').update({'unreadCounts.$userId': 0});
  }

  /// Search users by email prefix
  static Future<List<Map<String, dynamic>>> searchUsersByEmail(String query) async {
    if (query.trim().isEmpty) return [];
    final lower = query.toLowerCase();
    final snap = await _db
        .collection('users')
        .where('email', isGreaterThanOrEqualTo: lower)
        .where('email', isLessThanOrEqualTo: '$lower\uf8ff')
        .limit(10)
        .get();
    return snap.docs.map((d) => {'uid': d.id, ...d.data()}).toList();
  }

  /// Upload media to Firebase Storage and return download URL
  static Future<String> uploadChatMedia(String chatId, File file, String type) async {
    final ext = file.path.split('.').last;
    final filename = '${DateTime.now().millisecondsSinceEpoch}_${_rand()}.${ext.isNotEmpty ? ext : type}';
    final ref = _storage.ref('chats/$chatId/$filename');
    await ref.putFile(file);
    return await ref.getDownloadURL();
  }

  static String _rand() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return List.generate(7, (i) => chars[(DateTime.now().microsecondsSinceEpoch + i) % chars.length]).join();
  }
}
