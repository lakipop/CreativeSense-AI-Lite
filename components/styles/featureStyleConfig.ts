import { styleConfigs, StyleConfig, DescriptionStyle } from './styleConfig';

// Utility to remove common sentence-limit or brevity rules from the instruction text by
// splitting the text into sentences and removing any that look like a limit/constraint.
const stripSentenceLimit = (text: string): string => {
    if (!text) return text;
    // split into lines, then sentences
    const parts = text.split(/\n+/).flatMap(part => part.split(/(?<=[.!?])\s+/));
    const filtered = parts.filter(s => {
        const low = s.trim().toLowerCase();
        // Remove sentences that explicitly limit sentence counts or word counts
        if (/\b(1-2|1 - 2|one or two|one or two short|1 or 2)\b/.test(low) && /\bsentence(s)?\b/.test(low)) return false;
        if (/\bkeep (your|the|descriptions?|description)s?\b/.test(low) && /\bsentence(s)?\b/.test(low)) return false;
        if (/\bmust\b/.test(low) && /\bsentence(s)?\b/.test(low)) return false;
        if (/\bmax\b\s*\d+\s*words/.test(low)) return false;
        if (/\b(max|maximum)\s*\d+\s*words\b/.test(low)) return false;
        // Remove standalone sequences that are clearly constraints
        if (/\b(use one or two short sentences)\b/.test(low)) return false;
        if (/(keep descriptions to|keep your description to|keep responses to)/.test(low)) return false;
        return s.trim().length > 0;
    });
    // Rejoin using original paragraphing - keep newlines between big pieces
    return filtered.join(' ').replace(/\s+/g, ' ').trim();
};

const appendFeatureNotes = (text: string, feature: 'video' | 'live' | 'chat'): string => {
    if (feature === 'video') {
        return `${stripSentenceLimit(text)}\n\nNote: For video analysis, do NOT limit the response length. Provide a sequential, grounded description of the uploaded video from start to end and reference the provided frames for continuity.`;
    }
    if (feature === 'live') {
        return `${stripSentenceLimit(text)}\n\nNote: For live conversation mode, respond grounded to the user's voice input, do NOT limit the response length. Support explicit content if explicitly requested by the user. Use conversation context and transcriptions to preserve continuity.`;
    }
    // chat default
    return `${stripSentenceLimit(text)}\n\nNote: For chat mode, you may provide longer, unconstrained responses consistent with the chosen style. Use prior conversation context to maintain tone and continuity.`;
};

// Convert base StyleConfig to a feature-style variant
const convertStyle = (base: StyleConfig, feature: 'video' | 'live' | 'chat'): StyleConfig => {
    const newSystem = (userContext?: string) => appendFeatureNotes(base.systemInstruction(userContext), feature);
    // For video we need a more aggressive remapping of the frame prompt so the model does not
    // interpret "describe this single frame" and instead will produce a start-to-end video
    // description in the chosen style, maintaining narrative continuity across frames.
    const newPrompt = (history: string) => {
        if (feature === 'video') {
            const basePrompt = stripSentenceLimit(base.framePrompt(history));
            return `You are analyzing an uploaded video and have been provided frames in chronological order. ` +
                `Adopt the "${base.name}" style and produce a full, chronological description of the entire uploaded video from start to finish, grounded in the individual frames and the conversation history. ` +
                `Be detailed and continuous: reference frame progression, actions, and context where helpful. ` +
                `${basePrompt}${history ? `\n\nRecent context: ${history}` : ''}`;
        }
        return appendFeatureNotes(base.framePrompt(history), feature);
    };
    return {
        ...base,
        systemInstruction: newSystem,
        framePrompt: newPrompt,
        // Keep postProcess as-is
    };
};

export const videoStyleConfigs: Record<DescriptionStyle, StyleConfig> = Object.fromEntries(
    Object.entries(styleConfigs).map(([k, v]) => [k, convertStyle(v as StyleConfig, 'video')])
) as Record<DescriptionStyle, StyleConfig>;

export const liveConversationStyleConfigs: Record<DescriptionStyle, StyleConfig> = Object.fromEntries(
    Object.entries(styleConfigs).map(([k, v]) => [k, convertStyle(v as StyleConfig, 'live')])
) as Record<DescriptionStyle, StyleConfig>;

export const chatStyleConfigs: Record<DescriptionStyle, StyleConfig> = Object.fromEntries(
    Object.entries(styleConfigs).map(([k, v]) => [k, convertStyle(v as StyleConfig, 'chat')])
) as Record<DescriptionStyle, StyleConfig>;

export default { videoStyleConfigs, liveConversationStyleConfigs, chatStyleConfigs };
