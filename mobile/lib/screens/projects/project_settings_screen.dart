import 'package:msdev_mobile/widgets/ms_dev_loader.dart';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:firebase_auth/firebase_auth.dart';

class ProjectSettingsScreen extends StatefulWidget {
  final String projectId;
  const ProjectSettingsScreen({super.key, required this.projectId});

  @override
  State<ProjectSettingsScreen> createState() => _ProjectSettingsScreenState();
}

class _ProjectSettingsScreenState extends State<ProjectSettingsScreen> {
  Future<void> _deleteProject() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        title: const Text('Delete Project', style: TextStyle(color: Colors.white)),
        content: const Text('Are you sure you want to delete this project? This action cannot be undone and all data will be lost.', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel', style: TextStyle(color: Colors.white54))),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Delete Permanently', style: TextStyle(color: Colors.redAccent))),
        ],
      )
    );

    if (confirm == true) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Deleting project...')));
      await FirebaseFirestore.instance.doc('projects/${widget.projectId}').delete();
      if (mounted) {
        context.go('/projects');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleSpacing: 0,
        title: Text('Settings', style: GoogleFonts.raleway(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 20, color: Colors.white), 
          onPressed: () => context.pop(),
        ),
      ),
      body: StreamBuilder<DocumentSnapshot>(
        stream: FirebaseFirestore.instance.doc('projects/${widget.projectId}').snapshots(),
        builder: (context, snap) {
          if (!snap.hasData) return const Center(child: MsDevLoader(color: Color(0xFF10B981)));
          final p = snap.data!.data() as Map<String, dynamic>? ?? {};
          final name = p['name'] as String? ?? 'Project';
          final desc = p['description'] as String? ?? 'No description';
          final url = p['url'] as String? ?? '';
          final prefix = p['taskPrefix'] as String? ?? 'TASK';
          final members = p['members'] as Map<String, dynamic>? ?? {};

          return ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            children: [
              Text('Project Settings', style: GoogleFonts.raleway(fontSize: 24, fontWeight: FontWeight.w800, color: Colors.white)),
              const SizedBox(height: 4),
              Text('Manage project details, members, and access control', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13)),
              const SizedBox(height: 24),

              // General Settings
              _buildCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('General', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(99)),
                          child: const Text('Edit', style: TextStyle(color: Colors.white, fontSize: 12)),
                        )
                      ],
                    ),
                    const SizedBox(height: 16),
                    _buildField('Project Name', name),
                    const SizedBox(height: 12),
                    _buildField('Description', desc),
                    const SizedBox(height: 12),
                    _buildField('Live Project URL', url.isEmpty ? 'Not set' : url, valueColor: const Color(0xFF10B981)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(child: _buildField('Task Prefix', '$prefix-001', valueColor: const Color(0xFF10B981))),
                        const SizedBox(width: 12),
                        Expanded(child: _buildField('Project Status', 'Active')),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Invite Team Member
              _buildCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Invite Team Member', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: Container(
                            height: 40,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            alignment: Alignment.centerLeft,
                            decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF1E293B))),
                            child: const Text('colleague@company.com', style: TextStyle(color: Colors.white38, fontSize: 13)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          flex: 1,
                          child: Container(
                            height: 40,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF1E293B))),
                            child: const Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('Member', style: TextStyle(color: Colors.white, fontSize: 13)), Icon(Icons.arrow_drop_down, color: Colors.white, size: 16)]),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981), minimumSize: const Size(double.infinity, 40), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                      onPressed: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Invites are managed on web'))),
                      child: const Text('Invite', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(height: 8),
                    const Text('An invitation link will be sent. The user must sign in with the invited email address.', style: TextStyle(color: Colors.white38, fontSize: 10)),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Team Members
              _buildCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Team Members (${members.length})', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 16),
                    ...members.entries.map((e) {
                      final m = e.value as Map<String, dynamic>;
                      final displayName = m['displayName'] as String? ?? 'User';
                      final email = m['email'] as String? ?? '';
                      final role = m['role'] as String? ?? 'MEMBER';
                      final photo = m['photoURL'] as String?;
                      final isMe = e.key == FirebaseAuth.instance.currentUser?.uid;

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 18,
                              backgroundColor: const Color(0xFF1E293B),
                              backgroundImage: photo != null && photo.isNotEmpty ? NetworkImage(photo) : null,
                              child: (photo == null || photo.isEmpty) ? Text(displayName[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 14)) : null,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(displayName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                                      if (isMe) const Text(' (you)', style: TextStyle(color: Colors.white38, fontSize: 11)),
                                    ],
                                  ),
                                  Text(email, style: const TextStyle(color: Colors.white54, fontSize: 11)),
                                ],
                              ),
                            ),
                            if (role.toUpperCase() == 'ADMIN')
                              Text('ADMIN', style: TextStyle(color: const Color(0xFF10B981).withOpacity(0.8), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1))
                            else
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(4)),
                                child: const Text('Member ▾', style: TextStyle(color: Colors.white, fontSize: 11)),
                              ),
                            const SizedBox(width: 8),
                            if (!isMe)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(color: Colors.red.withOpacity(0.1), borderRadius: BorderRadius.circular(4), border: Border.all(color: Colors.red.withOpacity(0.3))),
                                child: const Text('Remove', style: TextStyle(color: Colors.redAccent, fontSize: 11)),
                              ),
                          ],
                        ),
                      );
                    }).toList(),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Danger Zone
              _buildCard(
                borderColor: Colors.red.withOpacity(0.3),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 20),
                        SizedBox(width: 8),
                        Text('Danger Zone', style: TextStyle(color: Colors.redAccent, fontSize: 16, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text('Deleting a project is permanent and cannot be undone. All tasks, activity, and data will be lost.', style: TextStyle(color: Colors.white54, fontSize: 12, height: 1.5)),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.red.withOpacity(0.1), side: BorderSide(color: Colors.red.withOpacity(0.3)), minimumSize: const Size(double.infinity, 40), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                      onPressed: _deleteProject,
                      child: const Text('Delete Project', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 40),
            ],
          );
        },
      ),
    );
  }

  Widget _buildCard({required Widget child, Color? borderColor}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor ?? Colors.white.withOpacity(0.05)),
      ),
      child: child,
    );
  }

  Widget _buildField(String label, String value, {Color? valueColor}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white54, fontSize: 11)),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF1E293B))),
          child: Text(value, style: TextStyle(color: valueColor ?? Colors.white, fontSize: 13, fontWeight: valueColor != null ? FontWeight.bold : FontWeight.normal)),
        ),
      ],
    );
  }
}
