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
    <div className="uc-token-gate">
      <div className="uc-token-card">
        <h1 className="font-heading text-2xl text-text-primary tracking-wide text-center mb-2">
          需要访问令牌
        </h1>
        <p className="text-text-muted text-sm text-center mb-8">
          令牌会显示在知识库服务的启动输出中，请复制后粘贴到这里。
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
            <p role="alert" className="uc-inline-status" data-severity="problem">{error}</p>
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
