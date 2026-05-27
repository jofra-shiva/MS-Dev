import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';

class MsDevLoader extends StatelessWidget {
  final bool small;
  final Color? color;
  final double? size;

  const MsDevLoader({super.key, this.small = false, this.color, this.size});

  @override
  Widget build(BuildContext context) {
    if (small) {
       return Center(
         child: Icon(Icons.code_rounded, color: color ?? const Color(0xFF06B6D4), size: size ?? 18)
            .animate(onPlay: (controller) => controller.repeat())
            .rotate(duration: 2.seconds),
       );
    }
    
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF06B6D4).withValues(alpha: 0.3)),
              color: const Color(0xFF06B6D4).withValues(alpha: 0.05),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF06B6D4).withValues(alpha: 0.1),
                  blurRadius: 20,
                  spreadRadius: -5,
                )
              ]
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.code_rounded, color: color ?? const Color(0xFF06B6D4), size: 26)
                    .animate(onPlay: (controller) => controller.repeat())
                    .shimmer(duration: 1500.ms, color: Colors.white)
                    .rotate(duration: 3000.ms),
                const SizedBox(width: 14),
                Text(
                  'MS DEV',
                  style: GoogleFonts.raleway(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: 2.5,
                  ),
                )
                .animate(onPlay: (controller) => controller.repeat())
                .shimmer(duration: 1500.ms, color: const Color(0xFF06B6D4)),
              ],
            ),
          ).animate(onPlay: (controller) => controller.repeat(reverse: true))
           .scaleXY(begin: 0.97, end: 1.03, duration: 1.seconds)
           .fadeIn(duration: 400.ms),
        ],
      ),
    );
  }
}
