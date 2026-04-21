import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GenerationConfig {
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  imageSize: "1K" | "2K" | "4K";
  customPrompt?: string;
}

export interface RoomAnalysis {
  style: string;
  colorPalette: string;
  lighting: string;
}

export async function analyzeRoom(roomImageBase64: string): Promise<RoomAnalysis> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `分析提供的房间图像并以结构化 JSON 格式提取以下参数。所有值必须使用中文描述：
{
  "style": "检测房间的风格（例如：现代简约、北欧、中式等）",
  "colorPalette": "识别房间的主色调",
  "lighting": "分析光照（例如：自然光、暖光）及其效果"
}
Output ONLY the raw JSON.`;

  try {
    const result = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: roomImageBase64,
              mimeType: "image/jpeg"
            }
          },
          {
            text: prompt
          }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const rawData = JSON.parse(result.text || "{}");
    
    const ensureString = (val: any) => {
      if (typeof val === 'string') return val;
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') {
        return Object.entries(val)
          .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
          .join(', ');
      }
      return String(val);
    };

    return {
      style: ensureString(rawData.style),
      colorPalette: ensureString(rawData.colorPalette),
      lighting: ensureString(rawData.lighting),
    };
  } catch (error) {
    console.error("分析房间图时出错:", error);
    throw new Error("模型分析失败，请检查图片或 API 配置。");
  }
}

export async function generateCarpetRendering(
  viewType: "wide" | "medium" | "closeup",
  roomImageBase64: string,
  carpetImageBase64: string,
  config: GenerationConfig,
  analysis: RoomAnalysis
): Promise<string> {
  const model = "gemini-3.1-flash-image-preview";
  
  const prompts = {
    wide: `全景图 (Wide View): Super ultra-high-definition professional interior photography. 
- QUALITY: 8k resolution, photorealistic, hyper-detailed, ray-traced lighting, razor-sharp textures.
- PLACEMENT: The carpet MUST be grounded on the floor. Furniture legs (sofa, tables) MUST rest naturally ON TOP of the carpet.
- SHADOWS: Ensure realistic contact shadows and ambient occlusion at the base of the furniture on the carpet.
- CONTEXT: Focus on the overall architectural harmony.`,
    medium: `中近景图 (Medium View): 4k resolution sharp-focus shot. 
- PERSPECTIVE: Distinctly different from the Wide View.
- COMPOSITION: A medium shot showing about 60% of the carpet, with high-end furniture surrounding it.
- PLACEMENT: Verify that the carpet is perfectly flat on the ground and sits UNDERNEATH the furniture.
- QUALITY: Extreme clarity, high contrast, professional studio lighting.`,
    closeup: `细节图 (Detail View): High-precision macro-photography (不模糊，极致清晰).
- COMPOSITION: The carpet surface is the focus, occupying 80% of the frame. 
- CONSISTENCY: This MUST be a fixed macro-detail shot. Use a shallow depth of field.
- CONTEXT: Include only a small part of a furniture leg or edge (e.g., 5% of the frame) as a contextual scale reference.
- CLARITY: Professional macro photography with extreme sharpness on the fiber texture and weaving.`
  };

  const fullPrompt = `STRICT GENERATION MANDATE:
Generate a COMPLETELY NEW architecturally unique room for this carpet. 
IMAGE QUALITY IS TOP PRIORITY: Produce the sharpest, clearest, and most realistic result possible. No blur, no noise, no compression artifacts (极致清晰，无模糊).

1. Analysis Input:
- Detected Style: ${analysis.style}
- Color Theme: ${analysis.colorPalette}
- Lighting Atmosphere: ${analysis.lighting}

2. ABSOLUTE DIVERSITY CONSTRAINT (ZERO REPLICATION):
- THE REFERENCE IMAGE IS ONLY FOR STYLE INSPIRATION. 
- DO NOT USE THE REFERENCE ROOM. You MUST create a different room structure entirely.
- ARCHITECTURE: Completely different room dimensions, different wall structures, and different ceiling heights.
- WINDOWS: Windows MUST be in different positions, or different shapes, or removed/added.
- FURNITURE: Use DIFFERENT furniture types and arrangements than the reference image.
- OVERALL: The final image should NOT look like it was taken in the same house as the reference image, only the ${analysis.style} VIBE should remain.

3. PHYSICAL PLACEMENT MANDATE (CRITICAL):
- GROUNDING: The carpet MUST be rendered as an integrated part of the floor, not a floating layer.
- OCCLUSION: All furniture (sofas, tables, chairs) located in the carpet area MUST be rendered ON TOP of the carpet. Their legs and bases must press into the carpet naturally.
- SHADOWS: Generate accurate contact shadows and ambient occlusion where furniture meets the carpet.

4. ARTISTIC CONSTRAINTS:
- CARPET INTEGRITY: The provided carpet pattern must remain 100% UNCHANGED.
- VIEW SPECIFIC: ${prompts[viewType]}
${config.customPrompt ? `\nIMPORTANT USER OVERRIDE: ${config.customPrompt}. If this request involves people or specific subjects, prioritize their complete and natural framing above all other view-specific constraints. Ensure maximum sharpness for the subjects.` : ""}

Generate the rendering now.`;

  try {
    const result = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: roomImageBase64,
              mimeType: "image/jpeg"
            }
          },
          {
            inlineData: {
              data: carpetImageBase64,
              mimeType: "image/jpeg"
            }
          },
          {
            text: fullPrompt
          }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: config.aspectRatio,
          imageSize: config.imageSize
        }
      }
    });

    for (const part of result.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("Gemini 未返回图像数据");
  } catch (error) {
    console.error(`生成 ${viewType} 渲染图时出错:`, error);
    throw error;
  }
}
