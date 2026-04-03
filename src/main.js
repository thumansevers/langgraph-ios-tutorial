import './style.css'

document.querySelector('#app').innerHTML = `
  <div class="page-shell">
    <header class="hero">
      <div class="hero-badge">LangGraph 入门 · iPhone 友好版</div>
      <h1>用一个可运行的小教程，快速学会 LangGraph</h1>
      <p class="hero-subtitle">
        这是一份适合在 iOS 浏览器里阅读的 LangGraph 学习页：先理解概念，再看最小示例，最后知道怎么自己改。
      </p>
      <div class="hero-actions">
        <a class="button primary" href="#quick-start">3 分钟上手</a>
        <a class="button" href="#example">看完整示例</a>
      </div>
    </header>

    <main class="content-grid">
      <aside class="toc-card">
        <p class="toc-title">目录</p>
        <nav>
          <a href="#what-is">1. LangGraph 是什么</a>
          <a href="#why">2. 为什么适合 Agent</a>
          <a href="#core">3. 四个核心概念</a>
          <a href="#quick-start">4. 最小示例</a>
          <a href="#example">5. 带条件分支的图</a>
          <a href="#ios">6. iPhone 学习建议</a>
          <a href="#next">7. 下一步怎么学</a>
        </nav>
      </aside>

      <section class="article-card">
        <section id="what-is" class="section-block">
          <p class="eyebrow">01 · 定义</p>
          <h2>LangGraph 是什么？</h2>
          <p>
            LangGraph 是一个用 <strong>图（Graph）</strong> 来组织 LLM / Agent 流程的框架。
            你可以把它理解成：把“一个复杂 Agent 任务”拆成多个节点，每个节点干一件事，节点之间按规则流转。
          </p>
          <div class="callout">
            <strong>一句话记忆：</strong>
            LangChain 更像“组件工具箱”，LangGraph 更像“可控工作流引擎”。
          </div>
        </section>

        <section id="why" class="section-block">
          <p class="eyebrow">02 · 价值</p>
          <h2>为什么它特别适合做 Agent？</h2>
          <div class="feature-list">
            <article>
              <h3>可控</h3>
              <p>你能明确规定下一步去哪里，而不是让流程全靠提示词漂移。</p>
            </article>
            <article>
              <h3>可循环</h3>
              <p>很适合“思考 → 调工具 → 再判断 → 再执行”这种闭环流程。</p>
            </article>
            <article>
              <h3>可追踪</h3>
              <p>状态集中管理，调试时能看见每一步输入输出。</p>
            </article>
            <article>
              <h3>可扩展</h3>
              <p>后面加检索、工具调用、多 Agent 协作都比较自然。</p>
            </article>
          </div>
        </section>

        <section id="core" class="section-block">
          <p class="eyebrow">03 · 核心概念</p>
          <h2>先记住这 4 个词</h2>
          <div class="concept-grid">
            <article>
              <span>State</span>
              <p>共享状态。整个图执行时用来传递数据的“上下文对象”。</p>
            </article>
            <article>
              <span>Node</span>
              <p>处理函数。每个节点读 state、改 state、返回新的字段。</p>
            </article>
            <article>
              <span>Edge</span>
              <p>边。定义节点之间怎么走，可以是固定流转，也可以是条件流转。</p>
            </article>
            <article>
              <span>Compile</span>
              <p>把你定义的流程图编译成一个可执行对象，然后 invoke / stream。</p>
            </article>
          </div>
        </section>

        <section id="quick-start" class="section-block">
          <p class="eyebrow">04 · 最小示例</p>
          <h2>一个最小 LangGraph：输入问题 → 输出答案</h2>
          <p>先看结构，不用一开始就追求复杂。</p>
          <pre><code>from typing import TypedDict
from langgraph.graph import StateGraph, START, END

class MyState(TypedDict):
    question: str
    answer: str


def answer_node(state: MyState):
    return {
        "answer": f"你问的是：{state['question']}"
    }

builder = StateGraph(MyState)
builder.add_node("answer", answer_node)
builder.add_edge(START, "answer")
builder.add_edge("answer", END)

graph = builder.compile()

result = graph.invoke({"question": "LangGraph 是什么？"})
print(result)</code></pre>

          <div class="tip-grid">
            <div>
              <strong>你会得到什么？</strong>
              <p>一个 state，其中 answer 被补上了。</p>
            </div>
            <div>
              <strong>这个例子学到什么？</strong>
              <p>State 负责传数据，Node 负责处理，Edge 负责流向。</p>
            </div>
          </div>
        </section>

        <section id="example" class="section-block">
          <p class="eyebrow">05 · 进阶示例</p>
          <h2>带条件判断的 Agent 流程</h2>
          <p>下面这个例子模拟一个简单思路：先判断问题类型，再走不同处理路径。</p>
          <pre><code>from typing import Literal, TypedDict
from langgraph.graph import StateGraph, START, END

class RouterState(TypedDict):
    user_input: str
    intent: str
    result: str


def classify_intent(state: RouterState):
    text = state["user_input"]
    if "天气" in text:
        intent = "weather"
    else:
        intent = "general"
    return {"intent": intent}


def weather_node(state: RouterState):
    return {"result": "这里可以接天气工具"}


def general_node(state: RouterState):
    return {"result": "这里可以接普通问答模型"}


def route(state: RouterState) -> Literal["weather", "general"]:
    return state["intent"]

builder = StateGraph(RouterState)
builder.add_node("classify", classify_intent)
builder.add_node("weather", weather_node)
builder.add_node("general", general_node)

builder.add_edge(START, "classify")
builder.add_conditional_edges("classify", route)
builder.add_edge("weather", END)
builder.add_edge("general", END)

graph = builder.compile()</code></pre>

          <div class="callout soft">
            <strong>这已经接近真实 Agent 了：</strong>
            分类节点决定走哪条路径，后面可以继续接工具调用、RAG、人工审批、循环重试。
          </div>
        </section>

        <section class="section-block">
          <p class="eyebrow">06 · 学习路线</p>
          <h2>建议你这样学，效率最高</h2>
          <ol class="steps-list">
            <li><strong>先学 StateGraph 基本结构</strong>：知道 node / edge / state 怎么配合。</li>
            <li><strong>再学 conditional edges</strong>：理解“条件路由”是 Agent 的关键。</li>
            <li><strong>然后学工具调用</strong>：把节点替换成调用搜索、数据库、API 的逻辑。</li>
            <li><strong>最后学循环与 checkpoint</strong>：做能持续思考、可恢复的 Agent。</li>
          </ol>
        </section>

        <section id="ios" class="section-block">
          <p class="eyebrow">07 · iOS 访问</p>
          <h2>这页为什么适合 iPhone Safari？</h2>
          <ul class="ios-list">
            <li>单页静态站，打开快，没复杂前端依赖。</li>
            <li>排版做了移动端优化，代码块可横向滚动。</li>
            <li>按钮和目录都适合手指点击。</li>
            <li>部署在 GitHub Pages 后，iOS 浏览器直接访问即可。</li>
          </ul>
        </section>

        <section id="next" class="section-block final-block">
          <p class="eyebrow">08 · 下一步</p>
          <h2>学完这页之后，你可以继续做什么？</h2>
          <div class="next-grid">
            <article>
              <h3>把示例改成真实 LLM 调用</h3>
              <p>把 answer_node 换成 OpenAI / Anthropic 调用。</p>
            </article>
            <article>
              <h3>增加工具节点</h3>
              <p>比如 web search、数据库查询、知识库检索。</p>
            </article>
            <article>
              <h3>做一个能循环的 Agent</h3>
              <p>让模型判断是否继续调用工具，直到完成任务。</p>
            </article>
          </div>
        </section>
      </section>
    </main>
  </div>
`
