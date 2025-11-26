export function getFemaleAndSinhalaVoices(useSinhala = false): SpeechSynthesisVoice[] {
  try {
    const voices = window.speechSynthesis.getVoices();
    const sinhalaVoices = voices.filter(v => v.lang.startsWith('si') || v.name.toLowerCase().includes('sinhala'));
    const femaleVoices = voices.filter(v => v.lang.startsWith('en') && (
      v.name.toLowerCase().includes('female') ||
      v.name.toLowerCase().includes('zira') ||
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('victoria') ||
      v.name.toLowerCase().includes('karen') ||
      (v.name.toLowerCase().includes('google') && v.name.toLowerCase().includes('female')) ||
      (v.name.toLowerCase().includes('microsoft') && v.name.toLowerCase().includes('female'))
    ));
    const fallback = voices.filter(v => v.lang.startsWith('en'));
    if (useSinhala && sinhalaVoices.length > 0) return sinhalaVoices;
    if (femaleVoices.length > 0) return femaleVoices;
    return fallback;
  } catch (e) {
    console.warn('Could not load voices from speechSynthesis', e);
    return [];
  }
}

export const DEFAULT_PREBUILT_VOICE_NAMES = ['Puck', 'Charon', 'Kore', 'autonoe', 'callirrhoe', 'erinome', 'sulafat', 'Fenrir', 'Aoede', 'garux', 'leda', 'despina', 'archernar', 'Zephyr'];
