import 'package:msdev_mobile/widgets/ms_dev_loader.dart';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

class CreateTaskBottomSheet extends StatefulWidget {
  final String projectId;
  final String initialMeetingId;
  final Map<String, dynamic>? initialTask;

  const CreateTaskBottomSheet({
    super.key,
    required this.projectId,
    required this.initialMeetingId,
    this.initialTask,
  });

  @override
  State<CreateTaskBottomSheet> createState() => _CreateTaskBottomSheetState();
}

class _CreateTaskBottomSheetState extends State<CreateTaskBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  
  String _title = '';
  String _description = '';
  String _type = 'bug';
  String _priority = 'medium';
  String _status = 'pending';
  String _module = '';
  String _tags = '';
  DateTime? _dueDate;
  String _assigneeId = '';
  String _assigneeName = '';
  String _assigneePhoto = '';
  String _selectedMeetingId = 'none';

  bool _isLoading = false;

  Map<String, dynamic> _projectMembers = {};
  List<QueryDocumentSnapshot> _meetings = [];
  List<String> _customModules = [];

  @override
  void initState() {
    super.initState();
    _selectedMeetingId = widget.initialMeetingId == 'all' ? 'none' : widget.initialMeetingId;
    
    if (widget.initialTask != null) {
      final t = widget.initialTask!;
      _title = t['title'] ?? '';
      _description = t['description'] ?? '';
      _type = t['type'] ?? 'bug';
      _priority = t['priority'] ?? 'medium';
      _status = t['status'] ?? 'pending';
      _module = t['module'] ?? '';
      _tags = (t['tags'] as List<dynamic>?)?.join(', ') ?? '';
      _dueDate = t['dueDate'] is Timestamp ? (t['dueDate'] as Timestamp).toDate() : null;
      _assigneeId = t['assigneeId'] ?? '';
      _assigneeName = t['assigneeName'] ?? '';
      _assigneePhoto = t['assigneePhoto'] ?? '';
      _selectedMeetingId = t['meetingId'] ?? widget.initialMeetingId;
    }
    
    _fetchProjectData();
  }

  Future<void> _fetchProjectData() async {
    final projDoc = await FirebaseFirestore.instance.collection('projects').doc(widget.projectId).get();
    if (projDoc.exists) {
      final data = projDoc.data();
      if (data != null) {
        if (data['members'] != null) {
          setState(() => _projectMembers = data['members'] as Map<String, dynamic>);
        }
        if (data['customModules'] != null) {
          setState(() => _customModules = List<String>.from(data['customModules']));
        }
      }
    }

    final meetingsSnap = await FirebaseFirestore.instance.collection('projects/${widget.projectId}/meetings').orderBy('createdAt', descending: true).get();
    setState(() {
      _meetings = meetingsSnap.docs;
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();

    setState(() => _isLoading = true);
    
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;

      final tagList = _tags.split(',').map((t) => t.trim()).where((t) => t.isNotEmpty).toList();

      final Map<String, dynamic> taskData = {
        'title': _title,
        'description': _description,
        'type': _type,
        'priority': _priority,
        'status': _status,
        'module': _module,
        'tags': tagList,
        'progress': 0,
      };

      if (_dueDate != null) {
        taskData['dueDate'] = Timestamp.fromDate(_dueDate!);
      } else {
        taskData['dueDate'] = null;
      }

      taskData['assigneeId'] = _assigneeId;
      taskData['assigneeName'] = _assigneeName;
      taskData['assigneePhoto'] = _assigneePhoto;
      taskData['meetingId'] = _selectedMeetingId == 'none' ? null : _selectedMeetingId;

      // Save custom module to DB if new
      if (_module.trim().isNotEmpty && !_customModules.contains(_module.trim())) {
        await FirebaseFirestore.instance.collection('projects').doc(widget.projectId).update({
          'customModules': FieldValue.arrayUnion([_module.trim()])
        });
      }

      if (widget.initialTask != null) {
        final taskId = widget.initialTask!['id'];
        await FirebaseFirestore.instance.collection('projects/${widget.projectId}/tasks').doc(taskId).update(taskData);
        
        await FirebaseFirestore.instance.collection('projects/${widget.projectId}/activity').add({
          'type': 'task_updated',
          'userId': user.uid,
          'userName': user.displayName ?? 'User',
          'userPhoto': user.photoURL ?? '',
          'taskId': taskId,
          'taskTitle': _title,
          'createdAt': FieldValue.serverTimestamp(),
        });
      } else {
        taskData['createdAt'] = FieldValue.serverTimestamp();
        taskData['createdBy'] = {
          'id': user.uid,
          'name': user.displayName ?? 'User',
          'photo': user.photoURL,
        };
        
        final ref = await FirebaseFirestore.instance.collection('projects/${widget.projectId}/tasks').add(taskData);

        await FirebaseFirestore.instance.collection('projects/${widget.projectId}/activity').add({
          'type': 'task_created',
          'userId': user.uid,
          'userName': user.displayName ?? 'User',
          'userPhoto': user.photoURL ?? '',
          'taskId': ref.id,
          'taskTitle': _title,
          'createdAt': FieldValue.serverTimestamp(),
        });
        
        if (_assigneeId.isNotEmpty && _assigneeId != user.uid) {
          await FirebaseFirestore.instance.collection('notifications/$_assigneeId/items').add({
            'type': 'task_assigned',
            'title': 'New Task Assigned',
            'message': '${user.displayName ?? 'User'} assigned you to "$_title"',
            'projectId': widget.projectId,
            'taskId': ref.id,
            'isRead': false,
            'createdAt': FieldValue.serverTimestamp(),
            'actionUrl': '/projects/${widget.projectId}/kanban'
          });
        }
      }

      if (mounted) Navigator.pop(context);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.w500)),
    );
  }

  Widget _buildTextField({required String label, required String hint, int maxLines = 1, String? initialValue, void Function(String?)? onSaved, String? Function(String?)? validator}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildLabel(label),
        TextFormField(
          initialValue: initialValue,
          maxLines: maxLines,
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
          onSaved: onSaved,
          validator: validator,
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildDropdown<T>({required String label, required T value, required List<DropdownMenuItem<T>> items, required void Function(T?) onChanged}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildLabel(label),
        Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A), 
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF1E293B)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<T>(
              value: value,
              isExpanded: true,
              dropdownColor: const Color(0xFF1E293B),
              icon: const Icon(Icons.keyboard_arrow_down, color: Colors.white54, size: 20),
              style: const TextStyle(color: Colors.white, fontSize: 14),
              items: items,
              onChanged: onChanged,
            ),
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final assigneeItems = [
      const DropdownMenuItem(value: '', child: Text('Unassigned')),
      ..._projectMembers.entries.map((e) {
        final m = e.value as Map<String, dynamic>;
        final displayName = m['displayName'] ?? 'User';
        final photoUrl = m['photoURL']?.toString() ?? '';
        final role = m['role'] ?? 'member';
        
        return DropdownMenuItem(
          value: e.key, 
          child: Row(
            children: [
              CircleAvatar(
                radius: 10,
                backgroundColor: Colors.white.withOpacity(0.1),
                backgroundImage: photoUrl.startsWith('http') ? NetworkImage(photoUrl) : null,
                child: !photoUrl.startsWith('http') ? Text(displayName[0].toUpperCase(), style: const TextStyle(fontSize: 10, color: Colors.white)) : null,
              ),
              const SizedBox(width: 8),
              Expanded(child: Text(displayName, overflow: TextOverflow.ellipsis)),
              const SizedBox(width: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(color: Colors.white.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                child: Text(role.toString().toUpperCase(), style: const TextStyle(fontSize: 8, color: Colors.white70)),
              )
            ],
          ),
        );
      }),
    ];

    final meetingItems = [
      const DropdownMenuItem(value: 'none', child: Text('No Meeting')),
      ..._meetings.map((m) {
        final name = (m.data() as Map)['name'] ?? (m.data() as Map)['title'] ?? 'Meeting';
        return DropdownMenuItem(value: m.id, child: Text(name));
      }),
    ];

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        height: MediaQuery.of(context).size.height * 0.95,
        decoration: const BoxDecoration(
          color: Color(0xFF0B1120),
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 16, 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(widget.initialTask != null ? 'Edit Task' : 'Create Task', style: GoogleFonts.raleway(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                  InkWell(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(8)),
                      child: const Icon(Icons.close, color: Colors.white54, size: 18),
                    ),
                  )
                ],
              ),
            ),
            
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          _buildTypeBtn('bug', 'Bug'),
                          const SizedBox(width: 12),
                          _buildTypeBtn('feature', 'Feature'),
                          const SizedBox(width: 12),
                          _buildTypeBtn('improvement', 'Improvement'),
                        ],
                      ),
                      const SizedBox(height: 24),

                      _buildLabel('Module / Category'),
                      Autocomplete<String>(
                        optionsBuilder: (TextEditingValue textEditingValue) {
                          if (textEditingValue.text.isEmpty) return _customModules;
                          return _customModules.where((m) => m.toLowerCase().contains(textEditingValue.text.toLowerCase()));
                        },
                        onSelected: (selection) => _module = selection,
                        fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
                          controller.text = _module;
                          return TextFormField(
                            controller: controller,
                            focusNode: focusNode,
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                            decoration: InputDecoration(
                              hintText: 'e.g. Authentication',
                              hintStyle: const TextStyle(color: Color(0xFF475569), fontSize: 14),
                              filled: true,
                              fillColor: const Color(0xFF0F172A),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF1E293B))),
                              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF1E293B))),
                              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFF10B981))),
                            ),
                            onSaved: (v) {
                              if (v != null && v.isNotEmpty) _module = v;
                            },
                          );
                        },
                      ),
                      const SizedBox(height: 16),

                      _buildTextField(label: 'Task Title *', hint: 'e.g. Implement authentication', initialValue: _title, validator: (v) => v!.isEmpty ? 'Enter title' : null, onSaved: (v) => _title = v!),
                      
                      _buildTextField(label: 'Description', hint: 'Describe task...', initialValue: _description, maxLines: 4, onSaved: (v) => _description = v ?? ''),
                      
                      Row(
                        children: [
                          Expanded(child: _buildDropdown(label: 'Priority', value: _priority, items: const [
                            DropdownMenuItem(value: 'low', child: Text('Low')),
                            DropdownMenuItem(value: 'medium', child: Text('Medium')),
                            DropdownMenuItem(value: 'high', child: Text('High')),
                            DropdownMenuItem(value: 'urgent', child: Text('Urgent')),
                          ], onChanged: (v) => setState(() => _priority = v!))),
                          const SizedBox(width: 16),
                          Expanded(child: _buildDropdown(label: 'Status', value: _status, items: const [
                            DropdownMenuItem(value: 'pending', child: Text('Pending')),
                            DropdownMenuItem(value: 'in_progress', child: Text('In Progress')),
                            DropdownMenuItem(value: 'testing', child: Text('Testing')),
                            DropdownMenuItem(value: 'completed', child: Text('Completed')),
                          ], onChanged: (v) => setState(() => _status = v!))),
                        ],
                      ),
                      
                      _buildDropdown(label: 'Meeting Source', value: _selectedMeetingId, items: meetingItems, onChanged: (v) => setState(() => _selectedMeetingId = v!)),
                      
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildLabel('Due Date'),
                                GestureDetector(
                                  onTap: () async {
                                    final date = await showDatePicker(
                                      context: context,
                                      initialDate: _dueDate ?? DateTime.now(),
                                      firstDate: DateTime.now().subtract(const Duration(days: 365)),
                                      lastDate: DateTime.now().add(const Duration(days: 365)),
                                    );
                                    if (date != null) setState(() => _dueDate = date);
                                  },
                                  child: Container(
                                    height: 48,
                                    padding: const EdgeInsets.symmetric(horizontal: 16),
                                    decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF1E293B))),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(_dueDate != null ? DateFormat('MM/dd/yyyy').format(_dueDate!) : 'mm/dd/yyyy', style: TextStyle(fontSize: 14, color: _dueDate != null ? Colors.white : const Color(0xFF475569))),
                                        const Icon(Icons.calendar_month_outlined, color: Color(0xFF475569), size: 18),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 16),
                              ],
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(child: _buildDropdown(label: 'Assign To', value: _assigneeId, items: assigneeItems, onChanged: (v) {
                            setState(() {
                              _assigneeId = v!;
                              if (v.isNotEmpty && _projectMembers[v] != null) {
                                _assigneeName = _projectMembers[v]['displayName'] ?? 'User';
                                _assigneePhoto = _projectMembers[v]['photoURL'] ?? '';
                              }
                            });
                          })),
                        ],
                      ),
                      
                      _buildTextField(label: 'Tags (comma-separated)', hint: 'frontend, bug', initialValue: _tags, onSaved: (v) => _tags = v ?? ''),
                      
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ),
            ),

            Container(
              padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).padding.bottom + 16),
              decoration: const BoxDecoration(
                color: Color(0xFF0B1120),
                border: Border(top: BorderSide(color: Color(0xFF1E293B))),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        side: const BorderSide(color: Color(0xFF1E293B)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cancel', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        elevation: 0,
                      ),
                      onPressed: _isLoading ? null : _submit,
                      child: _isLoading 
                        ? const SizedBox(height: 18, width: 18, child: MsDevLoader(small: true, color: Colors.white)) 
                        : Text(widget.initialTask != null ? 'Save Changes' : 'Create Task', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTypeBtn(String value, String label) {
    final isSelected = _type == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _type = value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: isSelected ? const Color(0xFF10B981) : const Color(0xFF1E293B)),
          ),
          child: Center(
            child: Text(label, style: TextStyle(color: isSelected ? const Color(0xFF10B981) : Colors.white54, fontSize: 13, fontWeight: FontWeight.bold)),
          ),
        ),
      ),
    );
  }
}
