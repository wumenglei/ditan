import React, { useState } from 'react';
import { Wand2, Loader2, Maximize, Box, Layers, Focus, Sparkles, ChevronRight, ImageIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageUpload } from './components/ImageUpload';
import { SettingsPanel } from './components/SettingsPanel';
import { generateCarpetRendering, GenerationConfig, analyzeRoom, RoomAnalysis } from './lib/gemini';

enum AppStep {
  ROOM_UPLOAD = 'ROOM_UPLOAD',
  ANALYZING = 'ANALYZING',
  PARAM_EDITING = 'PARAM_EDITING',
  CARPET_UPLOAD = 'CARPET_UPLOAD',
  RENDERING = 'RENDERING',
}

interface RenderingResult {
  wide: string | null;
  medium: string | null;
  closeup: string | null;
}

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.ROOM_UPLOAD);
  const [roomImage, setRoomImage] = useState<string | null>(null);
  const [carpetImage, setCarpetImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<RoomAnalysis>({
    style: '',
    colorPalette: '',
    lighting: '',
  });
  
  const [aspectRatio, setAspectRatio] = useState<GenerationConfig['aspectRatio']>('1:1');
  const [resolution, setResolution] = useState<GenerationConfig['imageSize']>('1K');
  const [customPrompt, setCustomPrompt] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RenderingResult>({ wide: null, medium: null, closeup: null });
  const [error, setError] = useState<string | null>(null);

  const [fullscreenImage, setFullscreenImage] = useState<{ url: string, title: string } | null>(null);

  // SaaS Integration State
  const [saasData, setSaasData] = useState<{
    userId?: string;
    toolId?: string;
    context?: string;
    prompt?: string[];
  }>({});
  const [userCredits, setUserCredits] = useState<number>(0);
  const [toolCredits, setToolCredits] = useState<number>(0);
  const [isSaasReady, setIsSaasReady] = useState(false);

  // postMessage Listener
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SAAS_INIT') {
        const { userId, toolId, context, prompt } = event.data;
        if (userId && toolId) {
          setSaasData({
            userId,
            toolId,
            context: context !== 'null' && context !== 'undefined' ? context : '',
            prompt: Array.isArray(prompt) ? prompt : []
          });
          setIsSaasReady(true);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Launch API
  React.useEffect(() => {
    if (isSaasReady && saasData.userId && saasData.toolId) {
      const launchTool = async () => {
        try {
          const response = await fetch('/api/tool/launch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: saasData.userId, toolId: saasData.toolId })
          });
          
          if (!response.ok) {
            const text = await response.text();
            console.warn("SaaS Launch failed with status:", response.status, text.substring(0, 100));
            return;
          }

          const result = await response.json();
          if (result.success) {
            setUserCredits(result.data.user.integral);
            setToolCredits(result.data.tool.integral);
          }
        } catch (err) {
          console.error("SaaS Launch failed:", err);
        }
      };
      launchTool();
    }
  }, [isSaasReady, saasData.userId, saasData.toolId]);

  const verifyCredits = async () => {
    if (!saasData.userId || !saasData.toolId) return true; // Bypass if not in SaaS env
    try {
      const response = await fetch('/api/tool/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: saasData.userId, toolId: saasData.toolId })
      });
      
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON or Error response from verify:", text.substring(0, 100));
        setError("服务器响应错误: 无法获取积分信息 (非JSON数据)");
        return false;
      }

      const result = await response.json();
      if (!result.success) {
        setError(result.message || "积分不足");
        return false;
      }
      return true;
    } catch (err: any) {
      console.error("Verify credits error:", err);
      setError("校验失败: " + err.message);
      return false;
    }
  };

  const consumeCredits = async () => {
    if (!saasData.userId || !saasData.toolId) return;
    try {
      const response = await fetch('/api/tool/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: saasData.userId, toolId: saasData.toolId })
      });
      
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const result = await response.json();
          if (result.success) {
            setUserCredits(result.data.currentIntegral);
          }
        }
      }
    } catch (err) {
      console.error("SaaS Consumption failed:", err);
    }
  };

  const handleAnalyze = async () => {
    if (!roomImage) {
      setError("请上传房间参考图。");
      return;
    }

    // Step 2: Verify
    const hasCredits = await verifyCredits();
    if (!hasCredits) return;

    setStep(AppStep.ANALYZING);
    setError(null);
    try {
      const result = await analyzeRoom(roomImage);
      setAnalysis(result);
      setStep(AppStep.PARAM_EDITING);
      // Step 3: Consume
      await consumeCredits();
    } catch (err: any) {
      setError(err.message);
      setStep(AppStep.ROOM_UPLOAD);
    }
  };

  const handleGenerate = async () => {
    if (!roomImage || !carpetImage) {
      setError("请确保已上传房间和地毯图片。");
      return;
    }

    setStep(AppStep.RENDERING);
    setLoading(true);
    setError(null);
    setResults({ wide: null, medium: null, closeup: null });

    const config: GenerationConfig = { aspectRatio, imageSize: resolution, customPrompt };

    // Step 2: Verify
    const hasCredits = await verifyCredits();
    if (!hasCredits) {
      setLoading(false);
      return;
    }

    try {
      // Create context-aware prompts by merging SaaS context if available
      const mergedConfig = {
        ...config,
        customPrompt: `${saasData.context ? `背景: ${saasData.context}\n` : ''}${saasData.prompt?.length ? `关键词: ${saasData.prompt.join(', ')}\n` : ''}${customPrompt}`
      };

      // Sequential generation (one by one)
      const wide = await generateCarpetRendering('wide', roomImage, carpetImage, mergedConfig, analysis);
      setResults(prev => ({ ...prev, wide }));
      
      const medium = await generateCarpetRendering('medium', roomImage, carpetImage, mergedConfig, analysis);
      setResults(prev => ({ ...prev, medium }));
      
      const closeup = await generateCarpetRendering('closeup', roomImage, carpetImage, mergedConfig, analysis);
      setResults(prev => ({ ...prev, closeup }));

      // Step 3: Consume
      await consumeCredits();
    } catch (err: any) {
      setError(err.message || "生成过程中出错。");
    } finally {
      setLoading(false);
    }
  };

  const updateAnalysisField = (field: keyof RoomAnalysis, value: string) => {
    setAnalysis(prev => ({ ...prev, [field]: value }));
  };

  if (step === AppStep.ROOM_UPLOAD || step === AppStep.ANALYZING || step === AppStep.PARAM_EDITING) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
        <nav className="fixed top-0 left-0 right-0 border-b border-zinc-100 bg-white/70 backdrop-blur-xl z-50">
          <div className="max-w-[1800px] mx-auto px-8 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-xl shadow-zinc-900/20">
                <Sparkles size={22} fill="currentColor" />
              </div>
              <div>
                <h1 className="font-display font-black text-xl tracking-tighter text-zinc-900 uppercase">
                  地毯摆放助手
                </h1>
                <p className="text-[10px] font-bold text-zinc-400 tracking-[0.2em] uppercase -mt-1">
                  AI Interior Intelligence
                </p>
              </div>
            </div>
          </div>
        </nav>

        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {step === AppStep.ROOM_UPLOAD && (
              <motion.div
                key="room-upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 text-center"
              >
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Step 01 / 结构解构
                  </div>
                  <h2 className="text-5xl font-display font-black tracking-tighter text-zinc-900 leading-none uppercase">上传房间参考图</h2>
                  <p className="text-zinc-500 text-sm max-w-md mx-auto">我们将基于此图的空间风格进行二次创作。请确保画面包含清晰的地面区域以便 AI 识别。</p>
                </div>
                
                <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-2xl shadow-zinc-200/50">
                  <ImageUpload 
                    id="room-upload"
                    label="选择参考空间" 
                    onImageSelect={setRoomImage} 
                  />
                  <button
                    onClick={handleAnalyze}
                    disabled={!roomImage}
                    className={`w-full mt-8 py-5 rounded-2xl flex items-center justify-center gap-3 font-display font-bold transition-all shadow-xl shadow-zinc-900/10 text-base
                      ${!roomImage ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}
                  >
                    <Maximize size={20} />
                    开始空间逻辑解析
                  </button>
                  {error && <p className="mt-4 text-xs font-bold text-red-500 uppercase tracking-widest">{error}</p>}
                </div>
              </motion.div>
            )}

            {step === AppStep.ANALYZING && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-8"
              >
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 border-4 border-zinc-100 rounded-full" />
                  <div className="absolute inset-0 border-4 border-zinc-900 rounded-full border-t-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="text-zinc-900 animate-pulse" size={32} />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-display font-black text-zinc-900 tracking-tight uppercase animate-pulse">正在深度解构空间逻辑 (Decoding...)</p>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em]">AI 渲染引擎正在提取风格、色调与材质感官</p>
                </div>
              </motion.div>
            )}

            {step === AppStep.PARAM_EDITING && (
              <motion.div
                key="param-editing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="space-y-8"
              >
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Step 02 / 参数微调
                  </div>
                  <h2 className="text-5xl font-display font-black tracking-tighter text-zinc-900 leading-none uppercase">解析结果反馈</h2>
                </div>

                <div className="bg-white p-10 rounded-[40px] border border-zinc-100 shadow-2xl shadow-zinc-200/50 space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    {(Object.keys(analysis) as Array<keyof RoomAnalysis>).map((key) => (
                      <div key={key} className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">
                          {key === 'style' ? '装修风格' : key === 'colorPalette' ? '色彩方案' : '光影环境'}
                        </label>
                        <input 
                          type="text" 
                          value={analysis[key]} 
                          onChange={(e) => updateAnalysisField(key, e.target.value)}
                          className="w-full text-sm font-bold p-4 bg-zinc-50 rounded-2xl border border-transparent focus:border-zinc-900 focus:bg-white outline-none transition-all shadow-inner"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 space-y-4">
                    <button
                      onClick={() => setStep(AppStep.CARPET_UPLOAD)}
                      className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-display font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/10 text-lg flex items-center justify-center gap-3"
                    >
                      确认参数并上传地毯
                      <ChevronRight size={20} />
                    </button>
                    <button 
                      onClick={() => setStep(AppStep.ROOM_UPLOAD)}
                      className="w-full py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] hover:text-red-500 transition-colors"
                    >
                      ← 重新上传房间参考图
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Navigation */}
      <nav className="border-b border-zinc-100 bg-white/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-xl shadow-zinc-900/20">
              <Sparkles size={22} fill="currentColor" />
            </div>
            <div>
              <h1 className="font-display font-black text-xl tracking-tighter text-zinc-900 uppercase">
                毯图大师 <span className="text-zinc-400">Pro</span>
              </h1>
              <p className="text-[10px] font-bold text-zinc-400 tracking-[0.2em] uppercase -mt-1">
                AI Interior Intelligence
              </p>
            </div>
          </div>
            <div className="flex items-center gap-8">
              {saasData.userId && (
                <div className="flex flex-col items-end mr-4">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">我的积分</span>
                  <span className="text-sm font-black text-zinc-900">{userCredits}</span>
                </div>
              )}
              <div className="hidden md:flex gap-8 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              <a href="#" className="text-zinc-900 border-b-2 border-zinc-900 pb-1">渲染中心</a>
              <a href="#" className="hover:text-zinc-900 transition-colors pb-1">分析引擎</a>
              <a href="#" className="hover:text-zinc-900 transition-colors pb-1">灵感库</a>
            </div>
            <div className="h-8 w-[1px] bg-zinc-200 hidden md:block" />
            <button className="text-[11px] font-bold uppercase tracking-widest px-6 py-2.5 rounded-full border border-zinc-200 hover:bg-zinc-50 transition-all">
              我的账户
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1800px] mx-auto px-8 py-12">
        <div className="grid lg:grid-cols-[440px_1fr] gap-16 items-start">
          {/* Left Sidebar: Intelligent Controls */}
          <div className="space-y-8 sticky top-32">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                <Wand2 size={12} />
                Step 03 / 效果渲染
              </div>
              <h2 className="text-4xl font-display font-black tracking-tighter text-zinc-900 leading-none">地毯上传</h2>
            </div>

            <div className="space-y-6">
              {(step === AppStep.CARPET_UPLOAD || step === AppStep.RENDERING) && (
                <div className="space-y-6">
                  <ImageUpload 
                    id="carpet-upload"
                    label="高精地毯图片 (Carpet)" 
                    onImageSelect={setCarpetImage} 
                  />
                  
                  <SettingsPanel 
                    aspectRatio={aspectRatio}
                    setAspectRatio={setAspectRatio}
                    resolution={resolution}
                    setResolution={setResolution}
                    customPrompt={customPrompt}
                    setCustomPrompt={setCustomPrompt}
                  />

                  <button
                    onClick={handleGenerate}
                    disabled={loading || !carpetImage}
                    className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-display font-semibold transition-all shadow-xl shadow-zinc-900/20
                      ${loading || !carpetImage
                        ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                        : 'bg-zinc-900 text-white hover:bg-zinc-800 hover:scale-[1.02] active:scale-95'}`}
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <Wand2 size={20} />}
                    {loading ? '正在进行精细化渲染...' : '同步 AI 生成效果图'}
                  </button>

                  <button 
                    onClick={() => setStep(AppStep.PARAM_EDITING)}
                    className="w-full py-2 text-xs font-bold text-zinc-400 uppercase tracking-widest hover:text-zinc-900 transition-colors"
                  >
                    返回修改空间参数
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
                {error}
              </div>
            )}
          </div>

            <div className="space-y-8">
            <div className="flex items-end justify-between border-b border-zinc-100 pb-8">
                <div>
                  <h2 className="text-4xl font-display font-black text-zinc-900 tracking-tighter uppercase">设计引擎实验室</h2>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        {step === AppStep.RENDERING ? '正在深度生成' : '引擎就绪'}
                      </span>
                    </div>
                    <div className="w-[1px] h-3 bg-zinc-200" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      画质: {resolution}
                    </span>
                  </div>
                </div>
              {loading && (
                <div className="flex items-center gap-3 px-5 py-2.5 bg-zinc-900 rounded-full text-white text-[10px] font-bold uppercase tracking-widest animate-pulse">
                  <Loader2 className="animate-spin" size={14} />
                  AI 智能重构中...
                </div>
              )}
            </div>

              {/* Analysis Information Context */}
              {(step === AppStep.CARPET_UPLOAD || step === AppStep.RENDERING || results.wide) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-900 rounded-[32px] p-8 text-white overflow-hidden relative"
                >
                  <div className="relative z-10 grid grid-cols-2 md:grid-cols-5 gap-6">
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">装修风格</p>
                      <p className="text-xs font-display font-bold truncate">{analysis.style}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">色彩方案</p>
                      <p className="text-xs font-display font-bold truncate">{analysis.colorPalette}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">光影环境</p>
                      <p className="text-xs font-display font-bold truncate">{analysis.lighting}</p>
                    </div>
                    <div className="space-y-1 border-l border-zinc-800 pl-4">
                      <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">AI 解析状态</p>
                      <p className="text-[10px] font-bold text-white flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-500" />
                        已深度对齐 (Aligned)
                      </p>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Box size={100} />
                  </div>
                </motion.div>
              )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="md:col-span-1">
                <RenderCard 
                  title="全景图" 
                  image={results.wide} 
                  loading={loading && !results.wide}
                  aspectRatio={aspectRatio}
                  icon={<Maximize size={20} />}
                  description="展示全新设计的 3D 空间结构，体现地毯在宏大环境中的气场。"
                  onPreview={() => results.wide && setFullscreenImage({ url: results.wide, title: "全景图" })}
                />
              </div>
              <div className="md:col-span-1">
                <RenderCard 
                  title="中近景图" 
                  image={results.medium} 
                  loading={loading && results.wide && !results.medium}
                  aspectRatio={aspectRatio}
                  icon={<Box size={20} />}
                  description="聚焦核心交互区，展现地毯纹理与定制家具的精致融合。"
                  onPreview={() => results.medium && setFullscreenImage({ url: results.medium, title: "中近景图" })}
                />
              </div>
              <div className="md:col-span-1">
                <RenderCard 
                  title="细节图" 
                  image={results.closeup} 
                  loading={loading && results.medium && !results.closeup}
                  aspectRatio={aspectRatio}
                  icon={<Layers size={20} />}
                  description="80% 画面占比聚焦，呈现极尽真实的纤维编织与工艺细节。"
                  onPreview={() => results.closeup && setFullscreenImage({ url: results.closeup, title: "细节图" })}
                />
              </div>
              </div>

            {/* Fullscreen Preview Modal */}
            <AnimatePresence>
              {fullscreenImage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] bg-zinc-900/95 backdrop-blur-xl flex flex-col p-8 md:p-12"
                  onClick={() => setFullscreenImage(null)}
                >
                  <div className="flex items-center justify-between mb-8">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-display font-black text-white uppercase tracking-tighter">{fullscreenImage.title}</h3>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">High-Definition Design Preview</p>
                    </div>
                    <button 
                      onClick={() => setFullscreenImage(null)}
                      className="p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <div className="flex-1 flex items-center justify-center overflow-hidden">
                    <motion.img
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      src={fullscreenImage.url}
                      alt={fullscreenImage.title}
                      className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {!loading && !results.wide && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-24 rounded-[40px] border-2 border-dashed border-zinc-100 flex flex-col items-center justify-center text-zinc-300 gap-6 bg-white/50"
                >
                  <div className="p-5 bg-zinc-50 rounded-[24px] border border-zinc-100">
                    <Wand2 size={40} className="text-zinc-200" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xl font-display font-black text-zinc-900 tracking-tight uppercase">实验室就绪 (System Idle)</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">请按照左侧步骤完成参数解构与地毯上传</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function RenderCard({ title, image, loading, icon, aspectRatio, description, isLarge, onPreview }: { 
  title: string, 
  image: string | null, 
  loading: boolean, 
  icon: React.ReactNode, 
  aspectRatio: string,
  description?: string,
  isLarge?: boolean,
  onPreview?: () => void
}) {
  const getAspectRatioClass = () => {
    if (isLarge) return 'aspect-[21/9] md:aspect-[16/7]';
    switch (aspectRatio) {
      case '1:1': return 'aspect-square';
      case '3:4': return 'aspect-[3/4]';
      case '9:16': return 'aspect-[9/16]';
      case '16:9': return 'aspect-[16/9]';
      default: return 'aspect-square';
    }
  };

  return (
    <div className="group space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-zinc-900 transition-colors">
          <div className="p-2 bg-white rounded-lg border border-zinc-100 shadow-sm group-hover:bg-zinc-900 group-hover:text-white transition-all duration-500">
            {icon}
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] font-display block leading-none">{title}</span>
            {description && <p className="text-[10px] text-zinc-400 mt-1 font-medium">{description}</p>}
          </div>
        </div>
      </div>
      <div 
        onClick={() => image && !loading && onPreview?.()}
        className={`${getAspectRatioClass()} rounded-[32px] bg-zinc-100 overflow-hidden relative border border-zinc-200/50 shadow-2xl shadow-zinc-200/20 group-hover:shadow-zinc-300/40 group-hover:scale-[1.01] transition-all duration-700 ease-out ${image && !loading ? 'cursor-zoom-in' : ''}`}
      >
        {loading && !image && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-20">
            <div className="w-16 h-16 rounded-full border-[3px] border-zinc-100 border-t-zinc-900 animate-spin" />
            <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-zinc-900 animate-pulse">正在精细渲染</p>
          </div>
        )}
        {image && (
          <motion.img
            initial={{ opacity: 0, filter: 'blur(10px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            src={image}
            alt={title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        )}
        {!image && !loading && (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 p-12 text-center bg-zinc-50/50 group-hover:bg-white transition-colors duration-500">
            <Box size={40} className="opacity-10 mb-4" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1">待激活视角</p>
            <p className="text-[9px] text-zinc-300">上传源文件以开启 AI 空间重构</p>
          </div>
        )}
        {/* Decorative corner */}
        <div className="absolute top-6 right-6 w-12 h-12 border-t-2 border-r-2 border-white/20 rounded-tr-xl pointer-events-none" />
      </div>
    </div>
  );
}

