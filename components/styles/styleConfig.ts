// Style configuration for ScreenDescriber modes

export type DescriptionStyle = 'action' | 'normal' | 'video-finder';

export interface StyleConfig {
    id: DescriptionStyle;
    name: string;
    icon: string;
    color: string;
    description: string;
    systemInstruction: (userContext?: string) => string;
    ttsInstruction?: (userContext?: string) => string;
    framePrompt: (last500Words: string) => string;
    postProcess?: (response: string) => string;
}

export const styleConfigs: Record<DescriptionStyle, StyleConfig> = {
    'action': {
        id: 'action',
        name: 'Action',
        icon: '⚡',
        color: 'blue',
        description: 'Short action-focused descriptions',
        systemInstruction: () => `You are a creative storyteller narrating a video. Based on this new frame and our chat history, continue the story. Describe what is happening in a narrative style. Focus on actions, emotions, and interactions. Avoid describing UI elements. Keep your description to one or two concise sentences.`,
        ttsInstruction: () => `Narrate the scene with a clear, engaging voice. Focus on a storytelling tone.`,
        framePrompt: (last500Words) => `You are a creative storyteller narrating a video. Based on this new frame and our chat history, continue the story. Describe what is happening in a narrative style. Focus on actions, emotions, and interactions. Avoid describing UI elements. Keep your description to one or two concise sentences.${last500Words ? `\n\nRecent story context: ${last500Words}` : ''}`
    },
    
    'normal': {
        id: 'normal',
        name: 'Normal',
        icon: '🎬',
        color: 'gray',
        description: 'General video description (any content)',
        systemInstruction: () => `You are a helpful video description assistant. Describe what you see in the video frames in a natural, clear, and objective way. Focus on the main subjects, actions, setting, and any notable visual elements. Keep descriptions concise and informative.`,
        ttsInstruction: () => `Provide a clear, objective narration. Speak in a neutral, informative tone.`,
        framePrompt: (last500Words) => `Describe this video frame clearly and objectively. What are the main subjects doing? What's the setting? Include relevant visual details.${last500Words ? `\n\nPrevious context: ${last500Words}` : ''}`
    },
    
    'video-finder': {
        id: 'video-finder',
        name: 'Video Finder',
        icon: '🔍',
        color: 'green',
        description: 'Find video source (like Google Lens)',
        systemInstruction: () => `You are a video identification assistant. Your task is to analyze video frames and identify potential sources. 

IMPORTANT: You cannot actually perform real-time Google searches or access external databases. Instead, you should:
1. Describe what you see in detail (actors/subjects, setting, visual style, production quality)
2. Identify distinctive visual markers that could help in searching (logos, text, unique elements)
3. Suggest search terms that would be effective for finding this video
4. If you recognize any public figures, productions, or known content, mention it

Be honest about limitations - you can provide analysis to help users search, but cannot provide actual search results or links.`,
        ttsInstruction: () => `Speak in a helpful and analytical tone. Clearly articulate the visual details and suggested search terms to assist the user in their search.`,
        framePrompt: () => `Analyze this frame to help identify the video source:

1. Describe visible subjects/actors in detail (physical description, clothing, distinctive features)
2. Identify the setting and production style
3. Note any visible text, logos, watermarks, or unique identifiers
4. Assess production quality and genre
5. Suggest effective search terms for finding this video

Provide specific details that would help someone search for this video using Google Lens or reverse image search.

Note: As an AI, I cannot actually search the internet or provide direct links. I can only analyze what I see and suggest search strategies.`
    },
};
