import 'package:msdev_mobile/widgets/ms_dev_loader.dart';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

class CreateMeetingScreen extends StatefulWidget {
  final String projectId;
  const CreateMeetingScreen({super.key, required this.projectId});

  @override
  State<CreateMeetingScreen> createState() => _CreateMeetingScreenState();
}

class _CreateMeetingScreenState extends State<CreateMeetingScreen> {
  final _titleCtrl = TextEditingController();
  final _linkCtrl = TextEditingController();
  DateTime _selectedDate = DateTime.now().add(const Duration(hours: 1));
  final Set<String> _selectedAttendees = {};
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _fetchLastMeetingLink();
  }

  Future<void> _fetchLastMeetingLink() async {
    try {
      final snap = await FirebaseFirestore.instance
          .collection('projects/${widget.projectId}/meetings')
          .orderBy('createdAt', descending: true)
          .limit(1)
          .get();
      if (snap.docs.isNotEmpty) {
        final link = snap.docs.first.data()['link'] as String?;
        if (link != null && link.isNotEmpty && mounted) {
          setState(() {
            _linkCtrl.text = link;
          });
        }
      }
    } catch (e) {}
  }

  Future<void> _pickDateTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(primary: Color(0xFF10B981), surface: Color(0xFF0F172A)),
        ),
        child: child!,
      ),
    );
    if (date == null || !mounted) return;

    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_selectedDate),
      builder: (context, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(primary: Color(0xFF10B981), surface: Color(0xFF0F172A)),
        ),
        child: child!,
      ),
    );
    if (time == null || !mounted) return;

    setState(() {
      _selectedDate = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  Future<void> _saveMeeting() async {
    if (_titleCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Meeting title is required')));
      return;
    }

    setState(() => _isLoading = true);
    try {
      final uid = FirebaseAuth.instance.currentUser!.uid;
      final ref = FirebaseFirestore.instance.collection('projects/${widget.projectId}/meetings').doc();
      await ref.set({
        'id': ref.id,
        'name': _titleCtrl.text.trim(),
        'link': _linkCtrl.text.trim(),
        'scheduledAt': Timestamp.fromDate(_selectedDate),
        'attendees': _selectedAttendees.toList(),
        'status': 'upcoming',
        'notes': '',
        'taskIds': [],
        'createdBy': uid,
        'createdAt': FieldValue.serverTimestamp(),
      });

      final user = FirebaseAuth.instance.currentUser!;
      await FirebaseFirestore.instance.collection('projects/${widget.projectId}/activity').add({
        'action': 'MEETING_CREATED',
        'userId': user.uid,
        'userName': user.displayName ?? 'User',
        'userPhoto': user.photoURL ?? '',
        'taskId': ref.id,
        'taskTitle': _titleCtrl.text.trim(),
        'createdAt': FieldValue.serverTimestamp(),
      });

      if (mounted) {
        context.pop();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Meeting created successfully!')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _linkCtrl.dispose();
    super.dispose();
  }

  Widget _buildLabel(String text, {Widget? extra}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Text(text, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.w500)),
          if (extra != null) ...[const SizedBox(width: 8), extra],
        ],
      ),
    );
  }

  Widget _buildTextField({required TextEditingController controller, required String hint}) {
    return TextField(
      controller: controller,
      style: const TextStyle(color: Colors.white, fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFF475569), fontSize: 14),
        filled: true,
        fillColor: const Color(0xFF0F172A),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF1E293B))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF1E293B))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF10B981))),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, size: 20, color: Colors.white),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFF0B1120),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF1E293B)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('New Meeting', style: GoogleFonts.raleway(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
              const SizedBox(height: 24),

              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 3,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildLabel('Meeting Name'),
                        _buildTextField(controller: _titleCtrl, hint: 'e.g. Weekly Sync'),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    flex: 2,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildLabel('Date'),
                        GestureDetector(
                          onTap: _pickDateTime,
                          child: Container(
                            height: 48,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0F172A),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFF1E293B)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    DateFormat('MM/dd/yy h:mm a').format(_selectedDate),
                                    style: const TextStyle(color: Colors.white, fontSize: 13),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const Icon(Icons.calendar_month_outlined, color: Color(0xFF475569), size: 16),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              _buildLabel(
                'Meeting Link (Optional)',
                extra: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFF10B981).withOpacity(0.1), borderRadius: BorderRadius.circular(99)),
                  child: const Text('From last meeting', style: TextStyle(color: Color(0xFF10B981), fontSize: 9, fontWeight: FontWeight.bold)),
                )
              ),
              _buildTextField(controller: _linkCtrl, hint: 'https://meet.google.com/...'),
              const SizedBox(height: 24),

              _buildLabel('Attendees'),
              StreamBuilder<DocumentSnapshot>(
                stream: FirebaseFirestore.instance.doc('projects/${widget.projectId}').snapshots(),
                builder: (context, snap) {
                  if (!snap.hasData) return const SizedBox.shrink();
                  final p = snap.data!.data() as Map<String, dynamic>? ?? {};
                  final members = p['members'] as Map<String, dynamic>? ?? {};

                  return Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: members.entries.map((e) {
                      final uid = e.key;
                      final m = e.value as Map<String, dynamic>;
                      final name = m['displayName'] as String? ?? 'User';
                      final photo = m['photoURL'] as String?;
                      final isSelected = _selectedAttendees.contains(uid);

                      return GestureDetector(
                        onTap: () => setState(() {
                          if (isSelected) _selectedAttendees.remove(uid);
                          else _selectedAttendees.add(uid);
                        }),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(99),
                            border: Border.all(color: isSelected ? const Color(0xFF10B981) : const Color(0xFF1E293B)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              CircleAvatar(
                                radius: 9,
                                backgroundColor: const Color(0xFF1E293B),
                                backgroundImage: photo != null && photo.startsWith('http') ? NetworkImage(photo) : null,
                                child: photo == null || !photo.startsWith('http')
                                    ? Text(name.isNotEmpty ? name[0].toUpperCase() : 'U', style: const TextStyle(fontSize: 8, color: Colors.white, fontWeight: FontWeight.bold))
                                    : null,
                              ),
                              const SizedBox(width: 6),
                              Text(name.split(' ').first, style: TextStyle(color: isSelected ? const Color(0xFF10B981) : Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  );
                },
              ),
              const SizedBox(height: 48),

              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                      side: const BorderSide(color: Color(0xFF1E293B)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () => context.pop(),
                    child: const Text('Cancel', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981), // Teal/Green
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                    onPressed: _isLoading ? null : _saveMeeting,
                    child: _isLoading 
                      ? const SizedBox(height: 18, width: 18, child: MsDevLoader(small: true, color: Colors.white)) 
                      : const Text('Save Meeting', style: TextStyle(color: Colors.black, fontWeight: FontWeight.w800, fontSize: 13)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
