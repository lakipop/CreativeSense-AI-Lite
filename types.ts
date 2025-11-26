export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface TranscriptionTurn {
    user: string;
    model: string;
}

export interface AnalyzerChatMessage {
  role: 'user' | 'model';
  text: string;
  files?: { name: string; url: string; type: string }[];
}

// Added for ScreenDescriber persistence
export type ContentPart = {
    text: string;
} | {
    inlineData: {
        mimeType: string;
        data: string;
    };
};

export type Content = {
    role: 'user' | 'model';
    parts: ContentPart[];
};

export interface ScreenDescriberSession {
  id: string;
  title: string;
  history: Content[];
  userContext?: string; // Persistent user-provided explicit context for model grounding
}
