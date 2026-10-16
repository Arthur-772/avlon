import type { MilkdownPlugin } from "@milkdown/kit/ctx";
import type { NodeViewConstructor } from "@milkdown/kit/prose/view";
import type { Mermaid } from "mermaid";

type DiagramModule = typeof import("@milkdown/plugin-diagram") & {
  mermaid: Mermaid;
};

let diagramModule: Promise<DiagramModule> | null = null;
let diagramViewCount = 0;
let renderQueue: Promise<unknown> = Promise.resolve();

async function importDiagramModule(): Promise<DiagramModule> {
  if (!diagramModule) {
    diagramModule = Promise.all([
      import("@milkdown/plugin-diagram"),
      import("mermaid"),
    ]).then(([pluginModule, mermaidModule]) => ({
      ...pluginModule,
      mermaid: mermaidModule.default,
    }));
  }
  return diagramModule;
}

export async function diagramPlugins(): Promise<MilkdownPlugin[]> {
  const { diagram, diagramSchema, mermaid } = await importDiagramModule();
  const { $view } = await import("@milkdown/utils");
  return [
    ...diagram,
    $view(diagramSchema.node, () => createDiagramView(mermaid)),
  ];
}

export function normalizeMermaidSource(source: string): string {
  if (!/^\s*erDiagram(?:\s|$)/m.test(source)) return source;
  return source.replace(
    /^(\s*\S+\s+\S+\s+)(PK|FK|UK)_(\S+)/gm,
    (_match, prefix: string, key: string, suffix: string) => `${prefix}${key} "${suffix}"`,
  );
}

function createDiagramView(mermaid: Mermaid): NodeViewConstructor {
  return (node) => {
    const container = document.createElement("div");
    container.className = "mermaid-view";
    const viewId = `easymd-mermaid-${++diagramViewCount}`;

    let currentSource: string | null = null;
    let renderToken = 0;

    const render = async (source: string): Promise<void> => {
      const token = ++renderToken;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: document.documentElement.dataset.theme === "dark" ? "dark" : "default",
      });
      const loading = document.createElement("div");
      loading.className = "mermaid-status";
      loading.textContent = "Mermaid...";
      container.replaceChildren(loading);

      try {
        // Mermaid needs an attached DOM when measuring text for ER diagrams.
        // A detached ProseMirror node-view container makes getBBox throw.
        const { svg } = await mermaid.render(
          `${viewId}-${token}`,
          normalizeMermaidSource(source),
        );
        if (token !== renderToken) return;

        const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
        const svgNode = parsed.documentElement;
        if (parsed.querySelector("parsererror") || svgNode.tagName !== "svg") {
          throw new Error("Invalid Mermaid SVG output");
        }
        const importedSvg = document.importNode(svgNode, true);
        if (!(importedSvg instanceof SVGSVGElement)) {
          throw new Error("Mermaid did not return an SVG");
        }
        importedSvg.setAttribute("role", "img");
        const viewBox = importedSvg.viewBox.baseVal;
        if (viewBox.width > 0 && viewBox.height > 0) {
          importedSvg.setAttribute("width", String(Math.ceil(viewBox.width)));
          importedSvg.setAttribute("height", String(Math.ceil(viewBox.height)));
          importedSvg.style.maxWidth = "none";
        }
        container.replaceChildren(importedSvg);
      } catch (error) {
        if (token !== renderToken) return;
        container.classList.add("has-error");
        const message = error instanceof Error ? error.message : String(error);
        const errorText = document.createElement("div");
        errorText.className = "mermaid-status";
        errorText.textContent = message;
        const sourceView = document.createElement("pre");
        sourceView.textContent = source;
        container.replaceChildren(errorText, sourceView);
      }
    };

    const initialSource = String(node.attrs.value ?? "");
    if (initialSource) {
      currentSource = initialSource;
      renderQueue = renderQueue.then(() => render(initialSource)).catch(() => undefined);
    }

    return {
      dom: container,
      update(node) {
        if (node.type.name !== "diagram") return false;
        const source = String(node.attrs.value ?? "");
        if (source === currentSource) return true;
        currentSource = source;
        container.classList.remove("has-error");
        renderQueue = renderQueue.then(() => render(source)).catch(() => undefined);
        return true;
      },
      ignoreMutation() {
        return true;
      },
      destroy() {
        renderToken += 1;
      },
    };
  };
}
