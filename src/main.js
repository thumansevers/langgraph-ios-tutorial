import './style.css'

document.querySelector('#app').innerHTML = `
  <div class="page-shell">
    <header class="hero">
      <div class="hero-badge">LangGraph + 后训练 · iPhone 友好课程版</div>
      <h1>从 LangGraph 入门，到理解大模型后训练</h1>
      <p class="hero-subtitle">
        这是一份适合在 iOS 浏览器里阅读的小课程：前半部分帮你理解 LangGraph，后半部分帮你建立对“后训练（Post-training）”的正确认知和常见做法。
      </p>
      <div class="hero-actions">
        <a class="button primary" href="#quick-start">3 分钟看懂 LangGraph</a>
        <a class="button" href="#post-training">直接看后训练</a>
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
          <a href="#example">5. 条件分支图</a>
          <a href="#study-path">6. 学习路线</a>
          <a href="#post-training">7. 后训练是什么</a>
          <a href="#methods">8. 后训练常见做法</a>
          <a href="#workflow">9. 实操流程</a>
          <a href="#misunderstanding">10. 容易混淆的点</a>
          <a href="#ios">11. iPhone 学习建议</a>
        </nav>
      </aside>

      <section class="article-card">
        <section id="what-is" class="section-block">
          <p class="eyebrow">01 · 定义</p>
          <h2>LangGraph 是什么？</h2>
          <p>
            LangGraph 是一个用 <strong>图（Graph）</strong> 来组织 LLM / Agent 流程的框架。
            你可以把它理解成：把“一个复杂 Agent 任务”拆成多个节点，每个节点只做一类工作，然后按规则流转。
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
              <p>共享状态。整个图执行时用来传递数据的上下文对象。</p>
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
              <p>把流程图编译成可执行对象，然后 invoke / stream。</p>
            </article>
          </div>
        </section>

        <section id="quick-start" class="section-block">
          <p class="eyebrow">04 · 最小示例</p>
          <h2>一个最小 LangGraph：输入问题 → 输出答案</h2>
          <p>先看最小结构，不用一开始就追求复杂。</p>
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

        <section id="study-path" class="section-block">
          <p class="eyebrow">06 · 学习路线</p>
          <h2>建议你这样学 LangGraph</h2>
          <ol class="steps-list">
            <li><strong>先学 StateGraph 基本结构</strong>：知道 node / edge / state 怎么配合。</li>
            <li><strong>再学 conditional edges</strong>：理解条件路由是 Agent 的关键。</li>
            <li><strong>然后学工具调用</strong>：把节点替换成搜索、数据库、API 调用。</li>
            <li><strong>最后学循环与 checkpoint</strong>：做能持续思考、可恢复的 Agent。</li>
          </ol>
        </section>

        <section id="post-training" class="section-block accent-block">
          <p class="eyebrow">07 · 重点专题</p>
          <h2>后训练（Post-training）到底是什么？</h2>
          <p>
            后训练，指的是：<strong>在基础预训练模型完成之后，为了让模型更会听话、更符合任务目标、更安全、更擅长某些能力，而做的后续训练阶段</strong>。
          </p>
          <div class="callout">
            <strong>最短理解：</strong>
            预训练让模型“会说话、懂很多”；后训练让模型“更像你想要的样子”。
          </div>
          <div class="two-column-text">
            <div>
              <h3>预训练像什么？</h3>
              <p>像让一个人先读了海量书，建立通用语言和世界知识。</p>
            </div>
            <div>
              <h3>后训练像什么？</h3>
              <p>像继续带这个人做专项训练：回答问题、遵守规范、学会拒绝危险请求、适配业务场景。</p>
            </div>
          </div>
        </section>

        <section id="methods" class="section-block">
          <p class="eyebrow">08 · 方法总览</p>
          <h2>后训练常见做法</h2>
          <div class="method-grid">
            <article>
              <h3>SFT（监督微调）</h3>
              <p>给模型一批“问题 → 理想答案”的样本，让它学会按目标格式和风格输出。</p>
            </article>
            <article>
              <h3>Preference / RLHF</h3>
              <p>让人类或规则系统比较两个回答哪个好，再训练模型更偏向优质回答。</p>
            </article>
            <article>
              <h3>DPO / IPO 等偏好优化</h3>
              <p>不一定显式跑强化学习，也能直接利用偏好对来优化模型输出倾向。</p>
            </article>
            <article>
              <h3>安全对齐训练</h3>
              <p>专门加入拒答、边界识别、风险场景数据，降低违规输出。</p>
            </article>
            <article>
              <h3>Tool-use / Agent 数据训练</h3>
              <p>让模型学会什么时候调用工具、怎么组织参数、何时结束。</p>
            </article>
            <article>
              <h3>领域微调</h3>
              <p>用医疗、金融、法务、客服等领域数据，让模型更懂特定业务语言。</p>
            </article>
          </div>
        </section>

        <section class="section-block">
          <p class="eyebrow">08A · 重点拆开说</p>
          <h2>SFT、RLHF、DPO 分别在干嘛？</h2>
          <div class="comparison-grid">
            <article>
              <span>SFT</span>
              <p><strong>目标：</strong>先把模型拉到“会按要求答题”的轨道上。</p>
              <p><strong>数据：</strong>指令-回答对。</p>
              <p><strong>直觉：</strong>像老师给标准答案，让学生照着学。</p>
            </article>
            <article>
              <span>RLHF</span>
              <p><strong>目标：</strong>让模型更偏向人类喜欢的回答。</p>
              <p><strong>数据：</strong>优劣回答排序、人类反馈。</p>
              <p><strong>直觉：</strong>像教练不断告诉模型“这个更好，那个更差”。</p>
            </article>
            <article>
              <span>DPO</span>
              <p><strong>目标：</strong>直接利用偏好对，简化偏好优化流程。</p>
              <p><strong>数据：</strong>chosen / rejected 回答对。</p>
              <p><strong>直觉：</strong>不用整套强化学习管线，也能做偏好对齐。</p>
            </article>
          </div>
        </section>

        <section id="workflow" class="section-block">
          <p class="eyebrow">09 · 实操流程</p>
          <h2>一个典型后训练项目怎么做？</h2>
          <ol class="steps-list">
            <li><strong>先定义目标</strong>：你想提升什么？是格式遵循、数学、代码、客服风格，还是安全拒答？</li>
            <li><strong>准备数据</strong>：收集高质量问答、工具轨迹、偏好对或业务语料。</li>
            <li><strong>做数据清洗</strong>：去重、去脏、统一格式、过滤低质量样本。</li>
            <li><strong>先跑 SFT</strong>：把模型拉到目标行为附近。</li>
            <li><strong>再做偏好优化</strong>：通过 RLHF / DPO 继续把输出往更优方向推。</li>
            <li><strong>离线评测 + 在线评测</strong>：看准确率、遵循率、拒答率、幻觉率、人工体验。</li>
            <li><strong>反复迭代数据</strong>：很多时候，真正决定效果的不是训练技巧，而是数据质量。</li>
          </ol>
          <div class="callout soft">
            <strong>很重要：</strong>
            后训练本质上不是“再喂点数据就行”，而是“围绕目标行为做数据设计、训练设计、评估设计”。
          </div>
        </section>

        <section id="misunderstanding" class="section-block">
          <p class="eyebrow">10 · 易错点</p>
          <h2>关于后训练，最容易混淆的 5 件事</h2>
          <div class="mistake-list">
            <article>
              <h3>1. 后训练 ≠ 继续预训练</h3>
              <p>继续预训练更偏“补知识语料”；后训练更偏“塑造行为和能力表现”。</p>
            </article>
            <article>
              <h3>2. 参数微调 ≠ 唯一方案</h3>
              <p>有时用 RAG、Prompt、Tool、Workflow 就能解决，不一定非要训模型。</p>
            </article>
            <article>
              <h3>3. 数据量不是唯一关键</h3>
              <p>少量高质量样本，往往比大量低质量样本更有价值。</p>
            </article>
            <article>
              <h3>4. 训练后不代表生产可用</h3>
              <p>还需要安全、稳定性、延迟、成本和回归评测。</p>
            </article>
            <article>
              <h3>5. Agent 能力很多靠系统设计</h3>
              <p>LangGraph 这类工作流框架解决的是“编排和执行”，不等于只靠模型后训练就能做好 Agent。</p>
            </article>
          </div>
        </section>

        <section class="section-block">
          <p class="eyebrow">10A · 什么时候该训，什么时候不该训？</p>
          <h2>一个简单判断法</h2>
          <div class="decision-grid">
            <article>
              <h3>优先不训练</h3>
              <p>如果问题只是知识不新、资料不全、流程不稳，优先考虑 RAG、工作流、工具调用、系统提示词。</p>
            </article>
            <article>
              <h3>考虑后训练</h3>
              <p>如果你需要稳定输出风格、严格格式、工具调用习惯、行业话术、安全边界，后训练更有价值。</p>
            </article>
          </div>
        </section>

        <section id="ios" class="section-block final-block">
          <p class="eyebrow">11 · iOS 访问</p>
          <h2>这页为什么适合 iPhone Safari？</h2>
          <ul class="ios-list">
            <li>单页静态站，打开快，没复杂前端依赖。</li>
            <li>排版做了移动端优化，代码块可横向滚动。</li>
            <li>按钮、目录、卡片都适合手指点击。</li>
            <li>部署在 GitHub Pages 后，iOS 浏览器直接访问即可。</li>
          </ul>
        </section>
      </section>
    </main>
  </div>
`
