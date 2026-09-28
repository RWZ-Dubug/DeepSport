import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

/**
 * 出错兜底。
 *
 * 为什么需要它？React 里只要有一个组件抛错，整棵界面树会被卸载 ——
 * 用户看到的就是**一片空白**，没有任何提示，完全不知道发生了什么。
 * 这是最难排查的故障。
 *
 * 有了这个组件之后，任何地方出错都会显示成一块红色的提示，
 * 把错误原文写出来，还能一键刷新。
 */
type Props = { children: ReactNode }
type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 同时打到浏览器控制台（F12 → Console），方便把原文发出来
    console.error('[DeepSport] 界面出错：', error, info)
  }

  render() {
    const { error } = this.state

    if (!error) return this.props.children

    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-500">
              <TriangleAlert size={18} />
            </span>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-slate-900">界面出错了</h1>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                按下 F12 打开控制台，把红色的报错原文发给我就行。下面是错误内容：
              </p>
            </div>
          </div>

          <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed break-words whitespace-pre-wrap text-red-700 ring-1 ring-slate-200">
            {error.message || String(error)}
          </pre>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <RefreshCw size={15} />
            刷新页面重试
          </button>
        </div>
      </div>
    )
  }
}
