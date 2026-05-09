// Liste noire simplifiée pour la détection de mots
const BANNED_WORDS = [
  'arnaque', 'escroquerie', 'hack', 'piratage', 'vol', 'drogue', 
  'arme', 'sexe', 'prostitution', 'fraude', 'insulte', 'connard', 'salope',
  'examen', 'devoir', 'partiel', 'évaluation', 'test en ligne'
];

const SUSPICIOUS_WORDS = [
  'paypal', 'western union', 'crypto', 'bitcoin', 'telegram', 'whatsapp', 
  'hors plateforme', 'urgent', 'cash'
];

export interface ModerationResult {
  flaggedWords: string[];
  severity: 'none' | 'low' | 'medium' | 'high';
}

/**
 * Analyse un texte pour détecter des mots interdits ou suspects
 * @param text Le texte à analyser (titre, description, etc.)
 * @returns Un objet contenant les mots détectés et la sévérité
 */
export const scanTextForModeration = (text: string): ModerationResult => {
  if (!text) return { flaggedWords: [], severity: 'none' };
  
  const normalizedText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const flaggedWords: string[] = [];
  
  // Check banned words (high severity)
  let hasBannedWords = false;
  BANNED_WORDS.forEach(word => {
    if (normalizedText.includes(word)) {
      flaggedWords.push(word);
      hasBannedWords = true;
    }
  });

  // Check suspicious words (medium/low severity)
  let suspiciousCount = 0;
  SUSPICIOUS_WORDS.forEach(word => {
    if (normalizedText.includes(word)) {
      flaggedWords.push(word);
      suspiciousCount++;
    }
  });

  let severity: ModerationResult['severity'] = 'none';
  if (hasBannedWords) {
    severity = 'high';
  } else if (suspiciousCount >= 2) {
    severity = 'medium';
  } else if (suspiciousCount === 1) {
    severity = 'low';
  }

  return { flaggedWords, severity };
};
