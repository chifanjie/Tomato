import { useState } from "react";

interface TokenGateProps {
  onTokenValid: (token: string) => void;
}

export default function TokenGate({ onTokenValid }: TokenGateProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = input.trim();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/knowledge-graph.json?token=${encodeURIComponent(token)}`);
      if (res.ok) {
        onTokenValid(token);
      } else if (res.status === 403) {
        setError("访问令牌无效，请检查后重试。");
      } else {
        setError(`服务器返回异常状态（${res.status}）。请确认知识库服务正在运行。`);
      }
    } catch (err) {
      console.warn("访问令牌验证请求失败", err);
      setError("无法连接服务器，请检查网络或确认知识库服务正在运行。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-root noise-overlay">
      <div className="w-full max-w-md px-8 py-10 bg-surface border border-border-subtle rounded-lg shadow-2xl">
        <h1 className="font-heading text-2xl text-text-primary tracking-wide text-center mb-2">
          需要访问令牌
        </h1>
        <p className="text-text-muted text-sm text-center mb-8">
          请粘贴终端中显示的访问令牌。请查找带有{" "}
          <span role="img" aria-label="钥匙">&#x1F511;</span> 的那一行。
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            aria-label="访问令牌"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(null);
            }}
            placeholder="在此粘贴访问令牌…"
            autoFocus
            className="w-full px-4 py-3 bg-elevated border border-border-subtle rounded text-text-primary placeholder:text-text-muted/50 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
          />

          {error && (
            <p role="alert" className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-full py-3 bg-accent text-root font-semibold rounded transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "正在验证…" : "继续"}
          </button>
        </form>
      </div>
    </div>
  );
}
