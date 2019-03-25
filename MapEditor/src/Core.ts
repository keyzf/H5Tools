import { PathSolution } from "./mappath/PathSolution";
export const Core = {
    /**
     * 地图列表
     */
    maps: new junyou.ArraySet<junyou.MapInfo>(),
    /**
     * 基础路径
     */
    basePath: "",
    /**
     * 全局配置
     */
    cfg: null as GlobalCfg,
    /**
     * 隐藏视图
     */
    hide: function (view: HTMLElement) {
        if (view && view.parentElement) {
            view.parentElement.removeChild(view);
        }
    },
    /**
     * 选中的地图，得到的运行时数据
     */
    selectMap: null as junyou.MapInfo,
    /**
     * 选中地图文件夹加载的配置数据
     */
    mapCfg: null as junyou.MapInfo,
    /**
     * 路径解决方案
     */
    pathSolution: null as PathSolution,
    createRadio(title: string, value: any, name: string, parent: Node, checked: boolean, onChange?: { (ev: Event) }) {
        const doc = document;
        let label = doc.createElement("label");
        parent.appendChild(label);
        let radio = doc.createElement("input");
        radio.value = value;
        radio.name = name;
        radio.checked = checked;
        radio.type = "radio";
        radio.addEventListener("change", onChange);
        label.appendChild(radio);
        let word = doc.createTextNode(title);
        label.appendChild(word);
    }
}