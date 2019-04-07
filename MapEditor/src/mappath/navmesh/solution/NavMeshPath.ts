import { PathSolution } from "../../PathSolution";
import { createRadio } from "../../../Core";
import Point = egret.Point;
import { Polygon } from "../geom/Polygon";

const enum Const {
    radioName = "radBlockPoint",
}

/**
 * 障碍点的状态
 */
const enum BlockPointState {
    None = 0,
    Add = 1,
    Del = 2
}

let btnBake: HTMLInputElement;
let btnEmpty: HTMLInputElement;
let state: BlockPointState;
const view = $g("StateEdit");

const polygons = [] as Polygon[];

let currentDraw: Polygon;

function setState() {
    state = +(document.querySelector(`input[name=${Const.radioName}]:checked`) as HTMLInputElement).value;
    window.removeEventListener("keyup", onKeyUp);
    if (state == BlockPointState.None) {
        view.removeEventListener("click", onClick);
    } else {
        view.addEventListener("click", onClick);
        if (state == BlockPointState.Add) {
            window.addEventListener("keyup", onKeyUp);
        }
    }
}

function onKeyUp(e: KeyboardEvent) {
    let keyCode = e.keyCode;
    if (keyCode == 8/**删除键 */ || keyCode == 46/**delete键 */) {
        if (currentDraw) {//做删除最后一个点的操作
            let vertexV = currentDraw.vertexV;
            removePoint(currentDraw, vertexV[vertexV.length - 1]);
            redraw();
        }
    }
}

function onClick(e: MouseEvent) {
    const { clientX, clientY } = e;
    //转换成格位坐标
    let dpr = window.devicePixelRatio;
    let pt = $engine._bg.globalToLocal(clientX / dpr, clientY / dpr);
    const { x, y } = pt;

    if (state == BlockPointState.Add) {
        if (!currentDraw) {
            currentDraw = new Polygon();
            polygons.push(currentDraw);
        }
        //检查点是否和之前的点相同
        let has = currentDraw.find(x, y);
        if (has) {//如果已经有很近的点了，不允许绘制，即便是转折点，也不给绘制
            let first = currentDraw.vertexV[0];
            if (has == first) {//回到第一个点了，进行封闭
                currentDraw.isEnd = true;
                currentDraw = undefined;
            }
        } else {
            currentDraw.add(pt);
        }

        redraw();
    } else if (state == BlockPointState.Del) {
        //检查当前点击的位置，是否离原有的点很近
        let cur: Point;
        let findPoly: Polygon;
        //检查当前点是否和当前`polygon`中的点相近
        for (let i = 0; i < polygons.length; i++) {
            const polygon = polygons[i];
            cur = polygon.find(x, y);
            if (cur) {
                findPoly = polygon;
                break;
            }
        }
        if (cur) {
            removePoint(findPoly, cur);
        }

    }
}

function removePoint(poly: Polygon, pt: Point) {
    poly.remove(pt);
    //删除点以后，多边形先解除封闭，需要重新进行封闭操作
    poly.isEnd = false;
    if (poly.vertexV.length == 0) {
        polygons.remove(poly);
        if (poly == currentDraw) {
            currentDraw = null;
        }
    }
    redraw();
}



let lblPixelPoint: HTMLLabelElement;
function showCoord(e: MouseEvent) {
    const { clientX, clientY } = e;
    let dpr = window.devicePixelRatio;
    let pt = $engine._bg.globalToLocal(clientX / dpr, clientY / dpr);
    lblPixelPoint.innerText = `像素坐标：${pt.x},${pt.y}`;
}

function redraw() {
    //TODO 重绘地图
    $engine.invalidate();
    $engine.render();
}


/**
 * 创建导航网格
 */
function onBake() {

}

function onClear() {

}


function showMapGrid() {
    $gm.$showMapGrid = true;
    //监听鼠标事件
    view.addEventListener("mousemove", showCoord);
    $engine.invalidate();
}

function hideMapGrid() {
    currentDraw = undefined;
    window.removeEventListener("keyup", onKeyUp);
    view.removeEventListener("click", onClick);
    $gm.$showMapGrid = false;
}

class DrawMapPathControl {
    @jy.d_memoize
    get view() {
        const div = document.createElement("div");
        btnEmpty = document.createElement("input");
        btnEmpty.type = "button";
        btnEmpty.value = "清理";
        btnEmpty.addEventListener("click", onClear);
        div.appendChild(btnEmpty);
        div.appendChild(document.createElement("br"));
        createRadio("无操作", BlockPointState.None, Const.radioName, div, true, setState);
        createRadio("添加障碍点", BlockPointState.Add, Const.radioName, div, false, setState);
        createRadio("移除障碍点", BlockPointState.Del, Const.radioName, div, false, setState);
        div.appendChild(document.createElement("br"));
        btnBake = document.createElement("input");
        btnBake.type = "button";
        btnBake.value = "烘焙网格";
        btnBake.addEventListener("click", onBake);

        lblPixelPoint = document.createElement("label");
        div.appendChild(lblPixelPoint);
        return div;
    };

    onToggle(flag: boolean) {
        if (flag) {
            showMapGrid();
        } else {
            hideMapGrid();
        }
    }

}

export class NavMeshPath implements PathSolution {
    readonly name = "导航网格";
    readonly editMapInfoControl = null;
    readonly drawMapPathControl = new DrawMapPathControl;
    setMapData(map: jy.MapInfo) {
        throw new Error("Method not implemented.");
    }
    getDataB64(pathdata: Uint8Array) {
        throw new Error("Method not implemented.");
    }
    onSave(opt: import("../../PathSolution").OnSaveOption) {
        throw new Error("Method not implemented.");
    }

    onEnterMap() {

        let bg = $engine.getLayer(jy.GameLayerID.Sorted) as jy.BaseLayer;
        let g = bg.graphics;
        //@ts-ignore
        $engine._bg.drawGrid = function (this: jy.TileMapLayer, x: number, y: number, w: number, h: number, map: MapInfo) {
            //检查polygon是否有点在范围内

            g.clear();
            if ($gm.$showMapGrid) {
                //检查polygon中的点是否在范围内
                let rect = new egret.Rectangle(x, y, w, h);
                for (let poly of polygons) {
                    let vertexV = poly.vertexV;
                    if (vertexV.find(p => rect.containsPoint(p))) {
                        let first = vertexV[0];
                        g.lineStyle(2, 0xff0000);
                        g.beginFill(0xff0000, 0.3);
                        g.moveTo(first.x, first.y);
                        for (let i = 1; i < vertexV.length; i++) {
                            const v = vertexV[i];
                            g.lineTo(v.x, v.y);
                        }
                        if (poly.isEnd) {
                            g.lineTo(first.x, first.y);
                            g.endFill();
                        }
                    }
                }
            }
        };
    }

}