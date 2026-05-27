import 'package:msdev_mobile/widgets/ms_dev_loader.dart';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../services/chat_service.dart';

class ChatScreen extends StatefulWidget {
  final String chatId;
  const ChatScreen({super.key, required this.chatId});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _uid = FirebaseAuth.instance.currentUser!.uid;
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _focusNode = FocusNode();

  ChatModel? _chat;

  ChatMessage? _replyTo;
  ChatMessage? _editing;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _loadChat();
    ChatService.markChatAsRead(widget.chatId, _uid);
  }

  Future<void> _loadChat() async {
    ChatService.subscribeToUserChats(_uid).listen((chats) {
      final found = chats.firstWhere((c) => c.id == widget.chatId, orElse: () => ChatModel(
        id: widget.chatId, type: 'direct', participants: [], participantDetails: {},
        unreadCounts: {}, createdAt: DateTime.now(), updatedAt: DateTime.now(),
      ));
      if (mounted) setState(() { _chat = found; });
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(_scrollCtrl.position.maxScrollExtent,
            duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty) return;

    String finalText = text;
    if (_replyTo != null) {
      final senderName = _chat?.participantDetails[_replyTo!.senderId]?.displayName ?? 'Someone';
      finalText = '> Replying to $senderName:\n> ${_replyTo!.text}\n\n$text';
    }

    _msgCtrl.clear();
    setState(() { _replyTo = null; });

    try {
      if (_editing != null) {
        await ChatService.editMessage(widget.chatId, _editing!.id, text);
        setState(() { _editing = null; });
      } else {
        await ChatService.sendMessage(
          chatId: widget.chatId,
          senderId: _uid,
          text: finalText,
        );
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to send message')));
    }
  }

  Future<void> _pickAndSendImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) return;

    setState(() => _uploading = true);
    try {
      final file = File(picked.path);
      final url = await ChatService.uploadChatMedia(widget.chatId, file, 'image');
      await ChatService.sendMessage(
        chatId: widget.chatId,
        senderId: _uid,
        text: picked.name,
        mediaUrl: url,
        mediaType: 'image',
      );
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to upload image')));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _showMessageOptions(ChatMessage msg) {
    final isMine = msg.senderId == _uid;
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF141C2F),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(margin: const EdgeInsets.only(top: 12, bottom: 16), width: 40, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
            ListTile(
              leading: const Icon(Icons.reply, color: Color(0xFF10B981)),
              title: const Text('Reply', style: TextStyle(color: Colors.white)),
              onTap: () { Navigator.pop(context); setState(() { _replyTo = msg; _editing = null; }); _focusNode.requestFocus(); },
            ),
            if (isMine && !msg.isDeleted) ...[
              ListTile(
                leading: const Icon(Icons.edit, color: Colors.white70),
                title: const Text('Edit', style: TextStyle(color: Colors.white)),
                onTap: () { Navigator.pop(context); setState(() { _editing = msg; _replyTo = null; _msgCtrl.text = msg.text; }); _focusNode.requestFocus(); },
              ),
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Color(0xFFEF4444)),
                title: const Text('Delete', style: TextStyle(color: Color(0xFFEF4444))),
                onTap: () async { Navigator.pop(context); await ChatService.deleteMessage(widget.chatId, msg.id); },
              ),
            ],
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) => DateFormat('HH:mm').format(dt);

  bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    if (_isSameDay(dt, now)) return 'Today';
    if (_isSameDay(dt, now.subtract(const Duration(days: 1)))) return 'Yesterday';
    return DateFormat('MMMM d, yyyy').format(dt);
  }

  Color _colorFromName(String name) {
    final colors = [
      const Color(0xFF3B82F6), const Color(0xFF10B981), const Color(0xFFF59E0B),
      const Color(0xFF8B5CF6), const Color(0xFFEC4899), const Color(0xFF6366F1),
    ];
    int hash = 0;
    for (var c in name.codeUnits) { hash = c + ((hash << 5) - hash); }
    return colors[hash.abs() % colors.length];
  }

  @override
  void dispose() {
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final chatName = _chat?.displayName(_uid) ?? '...';
    final chatPhoto = _chat?.displayPhoto(_uid) ?? '';
    final isGroup = _chat?.type == 'group';
    final nameColor = _colorFromName(chatName);

    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1117),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Row(
          children: [
            // Avatar
            isGroup
                ? Container(
                    width: 38, height: 38,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [nameColor, nameColor.withValues(alpha: 0.6)]),
                      shape: BoxShape.circle,
                    ),
                    child: Center(child: Text(chatName.isNotEmpty ? chatName[0].toUpperCase() : 'G',
                      style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800))),
                  )
                : CircleAvatar(
                    radius: 19,
                    backgroundColor: nameColor.withValues(alpha: 0.3),
                    backgroundImage: chatPhoto.isNotEmpty ? NetworkImage(chatPhoto) : null,
                    child: chatPhoto.isEmpty ? Text(chatName.isNotEmpty ? chatName[0].toUpperCase() : '?',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)) : null,
                  ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(chatName, style: GoogleFonts.raleway(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (isGroup && _chat != null)
                    Text('${_chat!.participants.length} members', style: const TextStyle(color: Colors.white38, fontSize: 11)),
                ],
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Messages List
          Expanded(
            child: StreamBuilder<List<ChatMessage>>(
              stream: ChatService.subscribeToChatMessages(widget.chatId),
              builder: (ctx, snap) {
                if (snap.connectionState == ConnectionState.waiting && !snap.hasData) {
                  return const Center(child: MsDevLoader(color: Color(0xFF10B981)));
                }
                final messages = snap.data ?? [];
                WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());

                if (messages.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('💬', style: TextStyle(fontSize: 48)),
                        const SizedBox(height: 12),
                        Text('No messages yet', style: GoogleFonts.raleway(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
                        const SizedBox(height: 6),
                        Text('Say hi! 👋', style: TextStyle(color: Colors.white.withValues(alpha: 0.4))),
                      ],
                    ),
                  );
                }

                return ListView.builder(
                  controller: _scrollCtrl,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  itemCount: messages.length,
                  itemBuilder: (_, i) {
                    final msg = messages[i];
                    final prev = i > 0 ? messages[i - 1] : null;
                    final showDate = prev == null || !_isSameDay(msg.createdAt, prev.createdAt);
                    return Column(
                      children: [
                        if (showDate) _buildDateDivider(msg.createdAt),
                        _buildMessageBubble(msg),
                      ],
                    );
                  },
                );
              },
            ),
          ),

          // Reply / Edit Banner
          if (_replyTo != null || _editing != null)
            _buildContextBanner(),

          // Upload indicator
          if (_uploading)
            Container(
              color: const Color(0xFF0D1117),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: const Row(
                children: [
                  SizedBox(width: 16, height: 16, child: MsDevLoader(small: true, color: Color(0xFF10B981))),
                  SizedBox(width: 10),
                  Text('Uploading...', style: TextStyle(color: Colors.white54, fontSize: 13)),
                ],
              ),
            ),

          // Input bar
          _buildInputBar(),
        ],
      ),
    );
  }

  Widget _buildDateDivider(DateTime dt) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 16),
    child: Row(
      children: [
        Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.07))),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(_formatDate(dt), style: const TextStyle(color: Colors.white38, fontSize: 12, fontWeight: FontWeight.w600)),
        ),
        Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.07))),
      ],
    ),
  );

  Widget _buildMessageBubble(ChatMessage msg) {
    final isMine = msg.senderId == _uid;
    final senderDetail = _chat?.participantDetails[msg.senderId];
    final senderName = senderDetail?.displayName ?? 'Unknown';
    final senderPhoto = senderDetail?.photoURL ?? '';
    final isGroup = _chat?.type == 'group';

    if (msg.isDeleted) {
      return Align(
        alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 3),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Text('This message was deleted', style: TextStyle(color: Colors.white30, fontStyle: FontStyle.italic, fontSize: 13)),
        ),
      );
    }

    // Parse reply
    final parsed = parseReply(msg.text);

    return GestureDetector(
      onLongPress: () => _showMessageOptions(msg),
      child: Align(
        alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
        child: Row(
          mainAxisAlignment: isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            // Avatar (group non-mine)
            if (!isMine && isGroup) ...[
              CircleAvatar(
                radius: 14,
                backgroundColor: _colorFromName(senderName).withValues(alpha: 0.3),
                backgroundImage: senderPhoto.isNotEmpty ? NetworkImage(senderPhoto) : null,
                child: senderPhoto.isEmpty ? Text(senderName.isNotEmpty ? senderName[0].toUpperCase() : '?', style: const TextStyle(color: Colors.white, fontSize: 10)) : null,
              ),
              const SizedBox(width: 6),
            ],
            Flexible(
              child: Container(
                margin: const EdgeInsets.symmetric(vertical: 3),
                constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                decoration: BoxDecoration(
                  color: isMine ? const Color(0xFF005C4B) : const Color(0xFF1E2740),
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(16),
                    topRight: const Radius.circular(16),
                    bottomLeft: Radius.circular(isMine ? 16 : 4),
                    bottomRight: Radius.circular(isMine ? 4 : 16),
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Sender name for groups
                      if (!isMine && isGroup)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text(senderName, style: TextStyle(color: _colorFromName(senderName), fontSize: 12, fontWeight: FontWeight.w700)),
                        ),

                      // Reply quote
                      if (parsed != null) ...[
                        Container(
                          margin: const EdgeInsets.only(bottom: 6),
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.black26,
                            borderRadius: BorderRadius.circular(8),
                            border: const Border(left: BorderSide(color: Color(0xFF10B981), width: 3)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(parsed.replyName, style: const TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.w700)),
                              const SizedBox(height: 2),
                              Text(parsed.quotedText, style: const TextStyle(color: Colors.white60, fontSize: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
                            ],
                          ),
                        ),
                        Text(parsed.actualText, style: const TextStyle(color: Colors.white, fontSize: 14)),
                      ] else if (msg.mediaType == 'image' && msg.mediaUrl != null) ...[
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(msg.mediaUrl!, width: 200, fit: BoxFit.cover,
                            loadingBuilder: (_, child, progress) => progress == null ? child
                                : Container(width: 200, height: 150, color: Colors.white10, child: const Center(child: MsDevLoader(small: true))),
                          ),
                        ),
                        if (msg.text.isNotEmpty && msg.text != msg.mediaUrl)
                          Padding(padding: const EdgeInsets.only(top: 4), child: Text(msg.text, style: const TextStyle(color: Colors.white, fontSize: 14))),
                      ] else
                        Text(msg.text, style: const TextStyle(color: Colors.white, fontSize: 14)),

                      // Time + edited
                      const SizedBox(height: 4),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          if (msg.isEdited)
                            const Text('edited · ', style: TextStyle(color: Colors.white30, fontSize: 10)),
                          Text(_formatTime(msg.createdAt), style: const TextStyle(color: Colors.white30, fontSize: 10)),
                          if (isMine) ...[
                            const SizedBox(width: 4),
                            const Icon(Icons.done_all, size: 12, color: Colors.white38),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContextBanner() {
    final isReply = _replyTo != null;
    final label = isReply ? 'Replying to' : 'Editing message';
    final content = isReply ? _replyTo!.text : _editing?.text ?? '';
    final senderName = isReply
        ? (_chat?.participantDetails[_replyTo!.senderId]?.displayName ?? 'Someone')
        : 'your message';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: Color(0xFF0D1117),
        border: Border(top: BorderSide(color: Color(0xFF1E2740))),
      ),
      child: Row(
        children: [
          Container(width: 3, height: 36, decoration: BoxDecoration(color: const Color(0xFF10B981), borderRadius: BorderRadius.circular(3))),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$label $senderName', style: const TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.w700)),
                Text(content, style: const TextStyle(color: Colors.white54, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, color: Colors.white38, size: 20),
            onPressed: () => setState(() { _replyTo = null; _editing = null; _msgCtrl.clear(); }),
          ),
        ],
      ),
    );
  }

  Widget _buildInputBar() {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0D1117),
        border: Border(top: BorderSide(color: Color(0xFF1A2133))),
      ),
      padding: EdgeInsets.only(
        left: 12, right: 12, top: 10,
        bottom: MediaQuery.of(context).viewInsets.bottom > 0 ? 10 : MediaQuery.of(context).padding.bottom + 10,
      ),
      child: Row(
        children: [
          // Attachment
          IconButton(
            icon: const Icon(Icons.attach_file, color: Colors.white38, size: 22),
            onPressed: _uploading ? null : _pickAndSendImage,
          ),

          // Text field
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF141C2F),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
              ),
              child: TextField(
                controller: _msgCtrl,
                focusNode: _focusNode,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                minLines: 1, maxLines: 5,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  hintText: 'Message...',
                  hintStyle: TextStyle(color: Colors.white30),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
                onSubmitted: (_) => _sendMessage(),
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Send button
          GestureDetector(
            onTap: _sendMessage,
            child: Container(
              width: 42, height: 42,
              decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
              child: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }
}

