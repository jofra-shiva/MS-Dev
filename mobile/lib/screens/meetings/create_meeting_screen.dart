import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';

class CreateMeetingScreen extends StatefulWidget {
  final String projectId;
  const CreateMeetingScreen({super.key, required this.projectId});

  @override
  State<CreateMeetingScreen> createState() => _CreateMeetingScreenState();
}

class _CreateMeetingScreenState extends State<CreateMeetingScreen> {
  final _titleCtrl = TextEditingController();
  final _agendaCtrl = TextEditingController();
  DateTime _selectedDate = DateTime.now().add(const Duration(hours: 1));
  final Set<String> _selectedAttendees = {};
  bool _isLoading = false;

  InputDecoration _inputDec(String hint, {IconData? icon}) => InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
        prefixIcon: icon != null ? Icon(icon, color: Colors.white.withOpacity(0.3), size: 18) : null,
        filled: true,
        fillColor: Colors.white.withOpacity(0.05),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFF59E0B)),
        ),
      );

  Future<void> _pickDateTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(primary: Color(0xFFF59E0B), surface: Color(0xFF0D1117)),
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
          colorScheme: const ColorScheme.dark(primary: Color(0xFFF59E0B), surface: Color(0xFF0D1117)),
        ),
        child: child!,
      ),
    );
    if (time == null || !mounted) return;

    setState(() {
      _selectedDate = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  Future<void> _createMeeting() async {
    if (_titleCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Meeting title is required')),
      );
      return;
    }
    if (_selectedAttendees.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select at least one attendee')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final uid = FirebaseAuth.instance.currentUser!.uid;
      final ref = FirebaseFirestore.instance.collection('projects/${widget.projectId}/meetings').doc();
      await ref.set({
        'id': ref.id,
        'title': _titleCtrl.text.trim(),
        'agenda': _agendaCtrl.text.trim(),
        'scheduledAt': Timestamp.fromDate(_selectedDate),
        'attendees': _selectedAttendees.toList(),
        'status': 'upcoming',
        'notes': '',
        'taskIds': [],
        'createdBy': uid,
        'createdAt': FieldValue.serverTimestamp(),
      });

      if (mounted) {
        context.pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Meeting scheduled!')),
        );
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
    _agendaCtrl.dispose();
    super.dispose();
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
        title: Text('Schedule Meeting', style: GoogleFonts.raleway(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Let\'s get the team together', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13)),
            const SizedBox(height: 28),

            // Meeting Details Section
            _sectionLabel('Meeting Details'),
            const SizedBox(height: 12),
            TextField(
              controller: _titleCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: _inputDec('Meeting Title', icon: Icons.groups_outlined),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _agendaCtrl,
              style: const TextStyle(color: Colors.white),
              maxLines: 3,
              decoration: _inputDec('Agenda / Notes (optional)', icon: Icons.notes_outlined),
            ),

            const SizedBox(height: 24),

            // Date & Time Section
            _sectionLabel('Date & Time'),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: _pickDateTime,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.white.withOpacity(0.1)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined, color: Color(0xFFF59E0B), size: 18),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          DateFormat('EEEE, MMMM d, yyyy').format(_selectedDate),
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          DateFormat('h:mm a').format(_selectedDate),
                          style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Icon(Icons.edit_outlined, color: Colors.white.withOpacity(0.3), size: 16),
                  ],
                ),
              ),
            ).animate().fadeIn(delay: 100.ms),

            const SizedBox(height: 24),

            // Attendees Section
            _sectionLabel('Attendees'),
            const SizedBox(height: 12),
            StreamBuilder<DocumentSnapshot>(
              stream: FirebaseFirestore.instance.doc('projects/${widget.projectId}').snapshots(),
              builder: (context, snap) {
                if (!snap.hasData) {
                  return const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)));
                }
                final p = snap.data!.data() as Map<String, dynamic>? ?? {};
                final members = p['members'] as Map<String, dynamic>? ?? {};

                if (members.isEmpty) {
                  return Text('No members found', style: TextStyle(color: Colors.white.withOpacity(0.4)));
                }

                return Column(
                  children: members.entries.map((e) {
                    final uid = e.key;
                    final m = e.value as Map<String, dynamic>;
                    final name = m['displayName'] as String? ?? 'User';
                    final email = m['email'] as String? ?? '';
                    final photo = m['photoURL'] as String?;
                    final role = (m['role'] as String? ?? 'member').toUpperCase();
                    final isSelected = _selectedAttendees.contains(uid);

                    return GestureDetector(
                      onTap: () => setState(() {
                        if (isSelected) {
                          _selectedAttendees.remove(uid);
                        } else {
                          _selectedAttendees.add(uid);
                        }
                      }),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? const Color(0xFFF59E0B).withOpacity(0.08)
                              : Colors.white.withOpacity(0.04),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isSelected
                                ? const Color(0xFFF59E0B).withOpacity(0.5)
                                : Colors.white.withOpacity(0.08),
                          ),
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 18,
                              backgroundColor: const Color(0xFF1E2740),
                              backgroundImage: photo != null && photo.startsWith('http')
                                  ? NetworkImage(photo)
                                  : null,
                              child: photo == null || !photo.startsWith('http')
                                  ? Text(
                                      name.isNotEmpty ? name[0].toUpperCase() : 'U',
                                      style: GoogleFonts.raleway(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white),
                                    )
                                  : null,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(name, style: GoogleFonts.raleway(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white)),
                                  Text(email, style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.4))),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFF38BDF8).withOpacity(0.12),
                                borderRadius: BorderRadius.circular(99),
                              ),
                              child: Text(role, style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 9, fontWeight: FontWeight.w800)),
                            ),
                            const SizedBox(width: 10),
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              width: 22,
                              height: 22,
                              decoration: BoxDecoration(
                                color: isSelected ? const Color(0xFFF59E0B) : Colors.transparent,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: isSelected ? const Color(0xFFF59E0B) : Colors.white.withOpacity(0.2),
                                  width: 2,
                                ),
                              ),
                              child: isSelected
                                  ? const Icon(Icons.check, color: Colors.white, size: 13)
                                  : null,
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                );
              },
            ),

            const SizedBox(height: 36),

            // Attendee count summary
            if (_selectedAttendees.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withOpacity(0.08),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.people_outline, color: Color(0xFFF59E0B), size: 16),
                    const SizedBox(width: 8),
                    Text(
                      '${_selectedAttendees.length} attendee${_selectedAttendees.length > 1 ? 's' : ''} selected',
                      style: const TextStyle(color: Color(0xFFF59E0B), fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                  ],
                ),
              ).animate().fadeIn().scale(begin: const Offset(0.95, 0.95)),

            if (_selectedAttendees.isNotEmpty) const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _createMeeting,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _isLoading
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : Text('Schedule Meeting', style: GoogleFonts.raleway(fontWeight: FontWeight.w800, fontSize: 16)),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ).animate().fadeIn(duration: 300.ms).slideY(begin: 0.08),
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(text, style: GoogleFonts.raleway(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white));
  }
}
