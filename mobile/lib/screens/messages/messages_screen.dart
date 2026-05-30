import 'package:msdev_mobile/widgets/ms_dev_loader.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../services/chat_service.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});
  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> with SingleTickerProviderStateMixin {
  final _uid = FirebaseAuth.instance.currentUser!.uid;
  final _auth = FirebaseAuth.instance.currentUser!;
  String _filter = 'all'; // all | unread | groups
  String _searchQuery = '';
  bool _showSearch = false;
  final _searchCtrl = TextEditingController();
  StreamSubscription? _projectSub;

  // User search
  bool _showNewChat = false;
  final _emailCtrl = TextEditingController();
  List<Map<String, dynamic>> _searchResults = [];
  bool _searching = false;

  @override
  void initState() {
    super.initState();
    _syncGroupChats();
  }

  Future<void> _syncGroupChats() async {
    try {
      final email = FirebaseAuth.instance.currentUser?.email ?? '';
      final isSuperAdmin = email == 'shivaprakash3115@gmail.com';

      final query = isSuperAdmin
          ? FirebaseFirestore.instance.collection('projects')
          : FirebaseFirestore.instance
                .collection('projects')
                .where('members.$_uid.role', whereIn: ['admin', 'member', 'viewer']);

      final snap = await query.get();
      final projects = snap.docs.map((d) => {'id': d.id, ...d.data()}).toList();
      await ChatService.syncProjectGroupChats(projects);
    } catch (_) {}
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final msgDay = DateTime(dt.year, dt.month, dt.day);
    if (msgDay == today) return DateFormat('HH:mm').format(dt);
    if (today.difference(msgDay).inDays == 1) return 'Yesterday';
    return DateFormat('dd/MM/yy').format(dt);
  }

  Color _colorFromName(String name) {
    final colors = [
      const Color(0xFF3B82F6), const Color(0xFF10B981),
      const Color(0xFFF59E0B), const Color(0xFFEF4444),
      const Color(0xFF8B5CF6), const Color(0xFFEC4899),
      const Color(0xFF06B6D4), const Color(0xFF6366F1),
    ];
    int hash = 0;
    for (var c in name.codeUnits) { hash = c + ((hash << 5) - hash); }
    return colors[hash.abs() % colors.length];
  }

  Future<void> _searchUsers(String q) async {
    if (q.trim().isEmpty) { setState(() => _searchResults = []); return; }
    setState(() => _searching = true);
    try {
      final results = await ChatService.searchUsersByEmail(q);
      setState(() => _searchResults = results.where((r) => r['uid'] != _uid).toList());
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _startChat(Map<String, dynamic> target) async {
    try {
      final chatId = await ChatService.startDirectChat(
        myUid: _uid,
        myName: _auth.displayName ?? '',
        myPhoto: _auth.photoURL ?? '',
        myEmail: _auth.email ?? '',
        targetUid: target['uid'],
        targetName: target['displayName'] ?? '',
        targetPhoto: target['photoURL'] ?? '',
        targetEmail: target['email'] ?? '',
      );
      if (mounted) {
        setState(() { _showNewChat = false; _emailCtrl.clear(); _searchResults = []; });
        context.push('/messages/$chatId');
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to start chat')));
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _emailCtrl.dispose();
    _projectSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1117),
        elevation: 0,
        title: _showSearch
            ? TextField(
                controller: _searchCtrl,
                autofocus: true,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  hintText: 'Search chats...',
                  hintStyle: TextStyle(color: Colors.white38),
                  border: InputBorder.none,
                ),
                onChanged: (v) => setState(() => _searchQuery = v),
              )
            : Text('Messages', style: GoogleFonts.raleway(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
        actions: [
          IconButton(
            icon: Icon(_showSearch ? Icons.close : Icons.search, color: Colors.white70),
            onPressed: () => setState(() {
              _showSearch = !_showSearch;
              if (!_showSearch) { _searchCtrl.clear(); _searchQuery = ''; }
            }),
          ),
          IconButton(
            icon: Container(
              width: 28, height: 28,
              decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
              child: const Icon(Icons.add, color: Colors.white, size: 18),
            ),
            onPressed: () => setState(() => _showNewChat = true),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Column(
        children: [
          // Filter Tabs
          Container(
            color: const Color(0xFF0D1117),
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Row(
              children: ['all', 'unread', 'groups'].map((f) {
                final sel = f == _filter;
                return GestureDetector(
                  onTap: () => setState(() => _filter = f),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                    decoration: BoxDecoration(
                      color: sel ? const Color(0xFF10B981).withValues(alpha: 0.15) : const Color(0xFF141C2F),
                      borderRadius: BorderRadius.circular(99),
                      border: Border.all(color: sel ? const Color(0xFF10B981) : Colors.white.withValues(alpha: 0.07)),
                    ),
                    child: Text(
                      f[0].toUpperCase() + f.substring(1),
                      style: TextStyle(
                        color: sel ? const Color(0xFF10B981) : Colors.white54,
                        fontSize: 13, fontWeight: sel ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          // Chat List
          Expanded(
            child: StreamBuilder<List<ChatModel>>(
              stream: ChatService.subscribeToUserChats(_uid),
              builder: (ctx, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: MsDevLoader(color: Color(0xFF10B981)));
                }
                var chats = snap.data ?? [];

                // Apply filters
                if (_filter == 'unread') chats = chats.where((c) => c.unreadFor(_uid) > 0).toList();
                if (_filter == 'groups') chats = chats.where((c) => c.type == 'group').toList();
                if (_searchQuery.isNotEmpty) {
                  final q = _searchQuery.toLowerCase();
                  chats = chats.where((c) => c.displayName(_uid).toLowerCase().contains(q)).toList();
                }

                if (chats.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('💬', style: TextStyle(fontSize: 48)),
                        const SizedBox(height: 16),
                        Text('No chats yet', style: GoogleFonts.raleway(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white)),
                        const SizedBox(height: 8),
                        Text('Tap + to start a conversation', style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 14)),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  itemCount: chats.length,
                  separatorBuilder: (_, __) => Divider(height: 1, color: Colors.white.withValues(alpha: 0.04), indent: 80),
                  itemBuilder: (_, i) => _buildChatTile(chats[i]),
                );
              },
            ),
          ),
        ],
      ),

      // New Chat Modal
      bottomSheet: _showNewChat ? _buildNewChatSheet() : null,
    );
  }

  Widget _buildChatTile(ChatModel chat) {
    final isGroup = chat.type == 'group';
    final name = chat.displayName(_uid);
    final photo = chat.displayPhoto(_uid);
    final unread = chat.unreadFor(_uid);
    final lastMsg = chat.lastMessage;
    final baseName = isGroup ? (chat.name ?? '').replaceAll(' Team', '') : '';
    final color = _colorFromName(baseName.isNotEmpty ? baseName : name);

    return InkWell(
      onTap: () async {
        if (unread > 0) await ChatService.markChatAsRead(chat.id, _uid);
        if (mounted) context.push('/messages/${chat.id}');
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            // Avatar
            _buildAvatar(name: name, photo: photo, isGroup: isGroup, color: color, unread: unread),
            const SizedBox(width: 14),

            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(name,
                          style: TextStyle(fontSize: 16, fontWeight: unread > 0 ? FontWeight.w700 : FontWeight.w500, color: Colors.white),
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (lastMsg != null)
                        Text(_formatTime(lastMsg.createdAt),
                          style: TextStyle(fontSize: 12, color: unread > 0 ? const Color(0xFF10B981) : Colors.white38)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          lastMsg?.text ?? (isGroup ? 'Group created' : 'Start a conversation'),
                          style: TextStyle(fontSize: 14, color: unread > 0 ? Colors.white70 : Colors.white38),
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (unread > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                          decoration: BoxDecoration(color: const Color(0xFF10B981), borderRadius: BorderRadius.circular(99)),
                          child: Text('$unread', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatar({required String name, required String photo, required bool isGroup, required Color color, required int unread}) {
    return Stack(
      children: [
        isGroup
            ? Container(
                width: 52, height: 52,
                decoration: BoxDecoration(gradient: LinearGradient(colors: [color, color.withValues(alpha: 0.6)], begin: Alignment.topLeft, end: Alignment.bottomRight), shape: BoxShape.circle),
                child: Center(child: Text(name.isNotEmpty ? name[0].toUpperCase() : 'G', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800))),
              )
            : CircleAvatar(
                radius: 26,
                backgroundColor: color.withValues(alpha: 0.3),
                backgroundImage: photo.isNotEmpty ? NetworkImage(photo) : null,
                child: photo.isEmpty ? Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)) : null,
              ),
      ],
    );
  }

  Widget _buildNewChatSheet() {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0D1117),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: Color(0xFF1E2740))),
      ),
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(margin: const EdgeInsets.only(top: 12, bottom: 8), width: 40, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('New Message', style: GoogleFonts.raleway(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
                IconButton(onPressed: () => setState(() { _showNewChat = false; _searchResults = []; _emailCtrl.clear(); }), icon: const Icon(Icons.close, color: Colors.white54)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: TextField(
              controller: _emailCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Search by email...',
                hintStyle: const TextStyle(color: Colors.white38),
                prefixIcon: const Icon(Icons.search, color: Colors.white38),
                filled: true, fillColor: const Color(0xFF141C2F),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onChanged: _searchUsers,
            ),
          ),
          if (_searching)
            const Padding(padding: EdgeInsets.all(16), child: MsDevLoader(small: true, color: Color(0xFF10B981))),
          if (_searchResults.isNotEmpty)
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 260),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _searchResults.length,
                itemBuilder: (_, i) {
                  final u = _searchResults[i];
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundColor: _colorFromName(u['displayName'] ?? ''),
                      backgroundImage: (u['photoURL'] ?? '').isNotEmpty ? NetworkImage(u['photoURL']) : null,
                      child: (u['photoURL'] ?? '').isEmpty ? Text((u['displayName'] ?? 'U')[0].toUpperCase(), style: const TextStyle(color: Colors.white)) : null,
                    ),
                    title: Text(u['displayName'] ?? 'Unknown', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                    subtitle: Text(u['email'] ?? '', style: const TextStyle(color: Colors.white38, fontSize: 12)),
                    onTap: () => _startChat(u),
                  );
                },
              ),
            ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

