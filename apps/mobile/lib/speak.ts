import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

/** Reads a sentence aloud: the browser's voice on the web build, the phone's voice otherwise. Never throws. */
export function speak(text: string): void {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      }
      return;
    }
    Speech.stop();
    Speech.speak(text, { language: 'en-GH', rate: 0.95 });
  } catch {
    // Voice is a convenience; staying silent is fine.
  }
}
