import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Paragraph from '@tiptap/extension-paragraph';
import { toPng } from 'html-to-image';

type Mode = 'novel' | 'chat' | 'hybrid';
type Ratio = 'auto' | '1 / 1' | '3 / 4' | '9 / 16';
type SpeakerId = 'a' | 'b';
type Theme = {
  background: string;
  foreground: string;
  accent: string;
  secondary: string;
  font: string;
  fontSize: number;
  lineHeight: number;
  padding: number;
  gap: number;
  ratio: Ratio;
  title: string;
  label: string;
  mode: Mode;
};
type Project = { document: JSONContent; theme: Theme };

const STORAGE_KEY = 'excerpt-studio-project-v1';
const initialTheme: Theme = {
  background: '#F2EDE6', foreground: '#28354A', accent: '#9D3445', secondary: '#344B70',
  font: 'Noto Serif KR', fontSize: 16, lineHeight: 1.95, padding: 52, gap: 17,
  ratio: 'auto', title: 'UNWRITTEN CHAPTER', label: 'EXCERPT / 001', mode: 'novel'
};
const initialDocument: JSONContent = {
  type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: '창밖에는 오래된 계절의 냄새가 남아 있었다.' }] },
    { type: 'paragraph', attrs: { speaker: 'a' }, content: [{ type: 'text', text: '“아직도 기억해?”' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '그는 조금 늦게 고개를 들었다.' }] },
    { type: 'paragraph', attrs: { speaker: 'b' }, content: [{ type: 'text', text: '“잊은 적 없어.”' }] }
  ]
};
const speakerParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      speaker: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-speaker'),
        renderHTML: (attributes: Record<string, unknown>) => attributes.speaker ? { 'data-speaker': attributes.speaker } : {}
      }
    };
  }
});
const presetThemes = [
  { name: 'Ivory', background: '#F2EDE6', foreground: '#28354A', accent: '#9D3445', secondary: '#344B70' },
  { name: 'Midnight', background: '#151E2D', foreground: '#D9E0E9', accent: '#E5A3AF', secondary: '#97B7E0' },
  { name: 'Paper', background: '#FAF9F6', foreground: '#252525', accent: '#8E3F3F', secondary: '#4B5C69' },
  { name: 'Bordeaux', background: '#291B23', foreground: '#F5E8E5', accent: '#E79A9B', secondary: '#AFC0E3' }
];
const fonts = ['Noto Serif KR', 'Gowun Batang', 'Noto Sans KR'];

function readSaved(): Project {
  try {
    const content = localStorage.getItem(STORAGE_KEY);
    if (content) {
      const saved = JSON.parse(content) as Partial<Project>;
      if (saved.document?.type === 'doc' && saved.theme) {
        return { document: saved.document, theme: { ...initialTheme, ...saved.theme } };
      }
    }
  } catch { /* corrupted storage is ignored */ }
  return { document: initialDocument, theme: initialTheme };
}

function richText(node: JSONContent, key: string): React.ReactNode {
  if (node.type === 'text') {
    let style: React.CSSProperties = {};
    let bold = false, italic = false, underline = false, strike = false;
    for (const mark of node.marks ?? []) {
      if (mark.type === 'textStyle' && typeof mark.attrs?.color === 'string') style = { ...style, color: mark.attrs.color };
      if (mark.type === 'bold') bold = true;
      if (mark.type === 'italic') italic = true;
      if (mark.type === 'underline') underline = true;
      if (mark.type === 'strike') strike = true;
    }
    if (underline || strike) style.textDecoration = [underline && 'underline', strike && 'line-through'].filter(Boolean).join(' ');
    return <span key={key} style={{ ...style, fontWeight: bold ? 700 : undefined, fontStyle: italic ? 'italic' : undefined }}>{node.text}</span>;
  }
  if (node.type === 'hardBreak') return <br key={key} />;
  return (node.content ?? []).map((child, index) => richText(child, `${key}-${index}`));
}

function getBlocks(document: JSONContent) {
  return (document.content ?? []).filter(node => ['paragraph', 'heading', 'blockquote'].includes(node.type ?? ''));
}

function App() {
  const [saved] = useState(readSaved);
  const [theme, setTheme] = useState<Theme>(saved.theme);
  const [document, setDocument] = useState<JSONContent>(saved.document);
  const [activeTab, setActiveTab] = useState<'theme' | 'type' | 'layout' | 'speakers'>('theme');
  const [status, setStatus] = useState('자동 저장 활성화');
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const exportLock = useRef(false);
  const editor = useEditor({
    extensions: [StarterKit.configure({ paragraph: false }), speakerParagraph, Underline, TextStyle, Color],
    content: saved.document,
    onUpdate: ({ editor }) => setDocument(editor.getJSON()),
    editorProps: { attributes: { class: 'text-editor', spellcheck: 'false' } }
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ document, theme })); setStatus('저장됨'); }
      catch { setStatus('브라우저 저장 공간이 부족해요'); }
    }, 450);
    return () => clearTimeout(timer);
  }, [document, theme]);

  const setSetting = <K extends keyof Theme>(key: K, value: Theme[K]) => setTheme(prev => ({ ...prev, [key]: value }));
  const speaker = editor?.getAttributes('paragraph').speaker as SpeakerId | undefined;
  const blocks = useMemo(() => getBlocks(document), [document]);
  const charCount = useMemo(() => blocks.map(b => (b.content ?? []).map(n => n.text ?? '').join('')).join('').length, [blocks]);
  const updateSpeaker = useCallback((value: string) => {
    if (!editor) return;
    editor.chain().focus().updateAttributes('paragraph', { speaker: value || null }).run();
  }, [editor]);

  const applyPreset = (preset: typeof presetThemes[number]) => setTheme(prev => ({ ...prev, ...preset }));
  const download = async () => {
    if (!previewRef.current || exportLock.current) return;
    exportLock.current = true;
    setExporting(true);
    setStatus('이미지 생성 중…');
    try {
      await documentFontsReady();
      const dataUrl = await toPng(previewRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: theme.background });
      const link = window.document.createElement('a');
      link.download = `excerpt-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      setStatus('PNG 저장 완료');
    } catch (error) {
      console.error(error);
      setStatus('이미지 저장 실패: 폰트 또는 브라우저 제한을 확인해 줘');
    } finally {
      setExporting(false);
      exportLock.current = false;
    }
  };
  const exportProject = () => {
    const blob = new Blob([JSON.stringify({ document, theme }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url; link.download = 'excerpt-project.json'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importProject = async (file?: File) => {
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text()) as Partial<Project>;
      if (imported.document?.type !== 'doc' || !imported.theme) throw new Error('Invalid project file');
      editor?.commands.setContent(imported.document);
      setTheme({ ...initialTheme, ...imported.theme });
      setStatus('프로젝트 불러오기 완료');
    } catch { setStatus('올바른 프로젝트 JSON 파일이 아니야'); }
  };

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">✳</span><div><strong>EXCERPT <em>STUDIO</em></strong><small>AI CHAT EXCERPT EDITOR</small></div></div>
      <div className="header-actions"><span className="save-status">● {status}</span><label className="ghost-button import-button">불러오기<input type="file" accept="application/json,.json" onChange={e => { void importProject(e.target.files?.[0]); e.target.value = ''; }}/></label><button className="ghost-button" onClick={exportProject}>프로젝트 저장</button><button className="primary-button" disabled={exporting} onClick={() => void download()}>{exporting ? '생성 중…' : '↓ PNG 저장'}</button></div>
    </header>
    <main className="workspace">
      <section className="editor-panel panel">
        <div className="panel-heading"><div><span className="eyebrow">01 / CONTENT</span><h2>텍스트 편집</h2></div><span className="mini-note">{charCount.toLocaleString()}자</span></div>
        <div className="editor-tools">
          <button title="굵게" className={editor?.isActive('bold') ? 'selected' : ''} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()}><b>B</b></button>
          <button title="기울임" className={editor?.isActive('italic') ? 'selected' : ''} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleItalic().run()}><i>I</i></button>
          <button title="밑줄" className={editor?.isActive('underline') ? 'selected' : ''} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleUnderline().run()}><u>U</u></button>
          <button title="취소선" className={editor?.isActive('strike') ? 'selected' : ''} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleStrike().run()}><s>S</s></button>
          <span className="separator" />
          <label className="inline-color" title="선택한 글자 색상">글자색 <input type="color" defaultValue="#9D3445" onInput={e => editor?.chain().focus().setColor(e.currentTarget.value).run()} /></label>
          <button title="선택한 글자의 직접 지정 색상 지우기" onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().unsetColor().run()}>색 초기화</button>
        </div>
        <div className="speaker-tools"><span>현재 문단 화자</span><button className={!speaker ? 'active' : ''} onMouseDown={e => e.preventDefault()} onClick={() => updateSpeaker('')}>서술</button><button className={speaker === 'a' ? 'active' : ''} onMouseDown={e => e.preventDefault()} onClick={() => updateSpeaker('a')}>화자 A</button><button className={speaker === 'b' ? 'active' : ''} onMouseDown={e => e.preventDefault()} onClick={() => updateSpeaker('b')}>화자 B</button></div>
        <EditorContent editor={editor} className="editor-wrapper" />
        <div className="editor-footer"><span>Enter로 문단을 나누고 화자를 지정해 봐.</span><button onClick={() => { if (window.confirm('작성한 글을 예시 글로 초기화할까?')) editor?.commands.setContent(initialDocument); }}>예시 복원 ↺</button></div>
      </section>
      <aside className="settings-panel panel">
        <div className="panel-heading"><div><span className="eyebrow">02 / CUSTOMIZE</span><h2>디자인 설정</h2></div></div>
        <div className="mode-switch" aria-label="발췌 모드">{(['novel', 'chat', 'hybrid'] as const).map((mode, index) => <button key={mode} className={theme.mode === mode ? 'active' : ''} onClick={() => setSetting('mode', mode)}>{['소설형', '채팅형', '혼합형'][index]}</button>)}</div>
        <div className="tabs">{([['theme', '테마'], ['type', '글꼴'], ['layout', '레이아웃'], ['speakers', '화자']] as const).map(([key, label]) => <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>{label}</button>)}</div>
        <div className="settings-content">
          {activeTab === 'theme' && <>
            <p className="setting-label">컬러 프리셋</p><div className="preset-grid">{presetThemes.map(preset => <button className="preset" key={preset.name} onClick={() => applyPreset(preset)}><span className="preset-swatch" style={{ background: preset.background, color: preset.foreground }}><span style={{ background: preset.accent }} /><span style={{ background: preset.secondary }} /></span><small>{preset.name}</small></button>)}</div>
            <ColorField label="배경색" value={theme.background} onChange={v => setSetting('background', v)} />
            <ColorField label="본문색" value={theme.foreground} onChange={v => setSetting('foreground', v)} />
            <ColorField label="화자 A / 강조색" value={theme.accent} onChange={v => setSetting('accent', v)} />
            <ColorField label="화자 B" value={theme.secondary} onChange={v => setSetting('secondary', v)} />
          </>}
          {activeTab === 'type' && <>
            <label className="setting-field"><span>폰트</span><select value={theme.font} onChange={e => setSetting('font', e.target.value)}>{fonts.map(font => <option key={font} value={font}>{font}</option>)}</select></label>
            <RangeField label="글자 크기" value={theme.fontSize} min={12} max={26} unit="px" onChange={v => setSetting('fontSize', v)} />
            <RangeField label="줄 간격" value={theme.lineHeight} min={1.2} max={2.8} step={0.05} unit="" onChange={v => setSetting('lineHeight', v)} />
            <RangeField label="문단 간격" value={theme.gap} min={0} max={50} unit="px" onChange={v => setSetting('gap', v)} />
          </>}
          {activeTab === 'layout' && <>
            <label className="setting-field"><span>이미지 비율</span><select value={theme.ratio} onChange={e => setSetting('ratio', e.target.value as Ratio)}><option value="auto">자동 높이</option><option value="1 / 1">1:1</option><option value="3 / 4">3:4</option><option value="9 / 16">9:16</option></select></label>
            <RangeField label="안쪽 여백" value={theme.padding} min={20} max={100} unit="px" onChange={v => setSetting('padding', v)} />
            <label className="setting-field"><span>상단 제목</span><input value={theme.title} maxLength={80} onChange={e => setSetting('title', e.target.value)} /></label>
            <label className="setting-field"><span>작은 문구</span><input value={theme.label} maxLength={80} onChange={e => setSetting('label', e.target.value)} /></label>
          </>}
          {activeTab === 'speakers' && <div className="help-card"><strong>화자 지정 방법</strong><p>왼쪽 편집기에서 문단 안에 커서를 놓고 <b>화자 A</b> 또는 <b>화자 B</b>를 눌러 줘.</p><p>서술 문단은 <b>서술</b>로 지정하면 돼. 채팅형에서는 지정한 화자를 말풍선으로 보여주고, 소설형에서는 대사 색상으로 구분해.</p><p>현재 버전은 A/B 두 화자를 지원해.</p></div>}
        </div>
      </aside>
      <section className="preview-panel panel">
        <div className="panel-heading"><div><span className="eyebrow">03 / OUTPUT</span><h2>미리보기</h2></div><span className="mini-note">{theme.ratio === 'auto' ? 'AUTO HEIGHT' : theme.ratio}</span></div>
        <div className="preview-scroller"><div className="preview-surface" ref={previewRef} style={{
          backgroundColor: theme.background, color: theme.foreground, fontFamily: `'${theme.font}', serif`,
          fontSize: `${theme.fontSize}px`, lineHeight: theme.lineHeight, padding: `${theme.padding}px`,
          aspectRatio: theme.ratio === 'auto' ? undefined : theme.ratio
        }}>
          <div className="excerpt-topline" style={{ color: theme.accent }}><span>{theme.label}</span><span>✳</span></div>
          <h1 className="excerpt-title">{theme.title}</h1>
          <div className={`excerpt-blocks mode-${theme.mode}`} style={{ gap: theme.gap }}>
            {blocks.length === 0 ? <p className="empty-preview">왼쪽에 텍스트를 입력해 줘.</p> : blocks.map((block, index) => {
              const who = block.attrs?.speaker as SpeakerId | null | undefined;
              const color = who === 'a' ? theme.accent : who === 'b' ? theme.secondary : theme.foreground;
              const speech = Boolean(who);
              if (theme.mode === 'chat' && speech) return <div className={`chat-line speaker-${who}`} key={index}><div className="chat-message" style={{ background: who === 'a' ? theme.accent : theme.secondary, color: theme.background }}><span className="chat-name">{who === 'a' ? 'A' : 'B'}</span><div>{richText(block, `block-${index}`)}</div></div></div>;
              if (theme.mode === 'hybrid' && speech) return <div className="hybrid-message" key={index} style={{ borderColor: color, color }}><small>{who === 'a' ? 'CHARACTER A' : 'CHARACTER B'}</small><div>{richText(block, `block-${index}`)}</div></div>;
              return <p key={index} className={speech ? 'novel-speech' : 'narration'} style={{ color }}>{richText(block, `block-${index}`)}</p>;
            })}
          </div>
          <div className="excerpt-bottom" style={{ borderColor: theme.accent, color: theme.accent }}><span>✳</span><span>END OF EXCERPT</span></div>
        </div></div>
        <div className="preview-footer"><span>실제 이미지 폭 600px · PNG 출력 2배</span><button className="primary-button" disabled={exporting} onClick={() => void download()}>PNG 다운로드 ↗</button></div>
      </section>
    </main>
    <footer className="app-footer"><span>EXCERPT STUDIO — Made for your stories.</span><span>텍스트는 브라우저에서만 처리돼요.</span></footer>
  </div>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="color-field"><span>{label}</span><span className="color-input"><input type="color" value={value} onChange={e => onChange(e.target.value)} /><code>{value.toUpperCase()}</code></span></label>;
}
function RangeField({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  return <label className="range-field"><span>{label}<strong>{Number(value.toFixed(2))}{unit}</strong></span><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /></label>;
}
async function documentFontsReady() { if (window.document.fonts) await window.document.fonts.ready; }
export default App;
