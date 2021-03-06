import { addRes } from "../res/Res";
import * as $path from "path";
const path: typeof $path = nodeRequire("path");
import * as $fs from "fs";
const fs: typeof $fs = nodeRequire("fs");
import * as $http from "http";

import { HGameEngine } from "./HGameEngine";
import { AniDele } from "./AniDele";
import { Core } from "../Core";
import { PathSolution, EditMapControl } from "../mappath/PathSolution";
import { PB } from "../pb/PB";

const enum CtrlName {
    MapPathCtrl = "divMapPath",
    EffectList = "divEffList",
}

let curCtrl: string;
const ctrlDict = {} as { [id: string]: EditMapControl };

function mapPathCtrlInit() {
    const current = PathSolution.current;


    const drawMapPathControl = current.drawMapPathControl;
    $("#divMapPath").append(drawMapPathControl.view);
    ctrlDict["divMapPath"] = drawMapPathControl;

    const areaGroupControl = current.areaGroupControl;
    if (areaGroupControl) {
        $("#divAreaGroup").append(areaGroupControl.view);
        ctrlDict["divAreaGroup"] = areaGroupControl;
    }

    $("#accControl").accordion({
        onUnselect: checkSelect,
        onSelect: checkSelect
    });

    for (let id in ctrlDict) {
        const ctrl = ctrlDict[id];
        if (ctrl.onInit) {
            ctrl.onInit(currentMap);
        }
    }

    return

    function checkSelect() {
        jy.Global.callLater($checkSelect, 0)
    }
    function $checkSelect() {
        let select = $("#accControl").accordion("getSelected");
        let flag = false;
        let ctxId: string;
        if (select) {
            let ctx = select.context;
            if (ctx && ctx.id == "divMapPath") {
                flag = true;
            }
            ctxId = ctx.id;
        }
        if (curCtrl != ctxId) {
            let old = ctrlDict[curCtrl];
            if (old) {
                old.onToggle(false);
            }
            curCtrl = ctxId;
            let ctrl = ctrlDict[curCtrl];
            if (ctrl) {
                ctrl.onToggle(true);
            }
            $engine.invalidate();
        }
    }
    checkSelect();
}

interface FileArray {
    length: number;
    [index: number]: File | string;
}


jy.ConfigUtils.getResUrl = function (uri: string) {
    return uri;
}

class Entry extends egret.Sprite {
    constructor() {
        super();
        this.on(EgretEvent.ADDED_TO_STAGE, this.onAdded, this);
    }

    onAdded() {
        //创建地图
        jy.GameEngine.init(this.stage, HGameEngine);
        jy.Global.initTick();
        jy.ResManager.init();
        showMap();
        mapPathCtrlInit();
    }
}

window["EgretEntry"] = Entry;

const view = $g("StateEdit");

/**
 * 用于显示特效列表的Div
 */
const divEffectPro = $("#divEffectPro");
const divControl = $("#divControl");
$("#bgColor").on("change", function () {
    view.style.backgroundColor = "#" + this.value;
})
divControl.draggable({
    handle: ".panel-header"
})
const dlEffectList = $("#dlEffectList");

const btnSave = $("#btnSave");
btnSave.on("click", saveMap);

const btnEditGroup = $("#btnEditGroup");
btnEditGroup.on("click", editGroup);

function editGroup() {
    $["messager"].prompt("", "添加分组标识", groupId => {
        if (!groupId) {
            return
        }
        groupId = groupId.trim();
        const effs = $engine.effs;
        for (let i = 0; i < effs.length; i++) {
            const eff = effs[i];
            if (eff.selected) {
                eff.group = groupId;
                effListFun("refreshRow", i);
            }
        }
    });

}

divEffectPro.hide();

function effListFun(...args) {
    return dlEffectList.datalist(...args);
}
effListFun({ onSelect: selectEff, textField: "text" });

const state = AppState.Edit;
let currentMap: jy.MapInfo;

document.addEventListener("keydown", onKeyDown);
document.addEventListener("keyup", onKeyUp);
document.addEventListener("selectstart", e => e.preventDefault());

let shiftDown = false;

function onKeyDown(e: KeyboardEvent) {
    if (e.keyCode == 16) {
        shiftDown = true;
    }
}

function onKeyUp(e: KeyboardEvent) {
    if (e.keyCode == 16) {
        shiftDown = false;
    }
}

let _effDragging = false;

jy.on(MapEvent.StartDragEff, function () {
    _effDragging = true;
})

jy.on(MapEvent.StopDragEff, function () {
    _effDragging = false;
})


view.addEventListener("dragover", e => e.preventDefault());
view.addEventListener("drop", onDrop);
const anis: { [index: string]: jy.AniInfo } = $DD.ani = {};
function onDrop(e: DragEvent) {
    e.preventDefault();
    let goted = checkAniFile(e.dataTransfer.files);
    if (goted) {
        let { key, dataPath, imgPath } = goted;
        checkAni(key, dataPath, imgPath);
        let { clientX, clientY } = e;
        //将坐标转换到game上
        let dpr = window.devicePixelRatio;
        let pt = $engine._bg.globalToLocal(clientX / dpr, clientY / dpr);
        let dele = new AniDele({ uri: key, layerID: jy.GameLayerID.CeilEffect, sX: 1, sY: 1, rotation: 0 });

        dele.setStartPoint(pt.x, pt.y);
        $engine.effs.pushOnce(dele);
        refreshEffectList();
    }
}

function checkAni(key: string, dataPath?: string, imgPath?: string) {
    let ani = anis[key];
    if (!ani) {
        if (!dataPath) {
            dataPath = path.join(Core.basePath, Core.cfg.effectPath, key, ConstString.AniDataFile);
        }
        if (!imgPath) {
            imgPath = path.join(Core.basePath, Core.cfg.effectPath, key, ConstString.AniImageFile);
        }
        if (!fs.existsSync(dataPath)) {
            return alert(`找不到指定的特效配置文件[${dataPath}]`)
        }
        let str = fs.readFileSync(dataPath, "utf8");
        let data;
        try {
            data = JSON.parse(str);
        } catch (e) {
            return alert(`特效配置文件[${dataPath}]有误`);
        }
        ani = new jy.AniInfo();
        ani.init(key, data);
        if (!ani.actionInfo.isCircle) {
            return alert(`特效配置文件不是循环动画，请检查`);
        }
        let filename = path.basename(imgPath);
        addRes(`${jy.ResPrefix.Ani}${key}/${filename}`, imgPath);
        anis[key] = ani;
    }
}

function checkAniFile(files: FileArray, parent: string = "") {
    // 必须同时找到
    let goted: { imgPath: string, dataPath: string, key: string } = null;
    let imgPath: string;
    let dataPath: string;
    // 遍历文件，检查文件是否匹配
    for (let i = 0, len = files.length; i < len; i++) {
        let file = files[i];
        if (path) { // 如果是Electron环境
            let p: string;
            if (typeof file === "string") {
                p = path.join(parent, <string>file);
            } else {
                // 检查路径
                p = file["path"];
            }
            let fstats = fs.statSync(p);
            // 如果是文件夹
            if (fstats.isDirectory()) {
                goted = checkAniFile(fs.readdirSync(p), p);
            } else if (fstats.isFile()) {// 检查文件
                let re = path.parse(p);
                if (re.ext == ".png") {
                    imgPath = p;
                } else if (re.base == ConstString.AniDataFile) {
                    dataPath = p;
                }
                if (imgPath && dataPath) {
                    // 得到上级目录
                    let key = path.basename(re.dir);
                    goted = { imgPath, dataPath, key };
                }
            }
            if (goted) {
                return goted;
            }
        }
    }
}

function setData(map: jy.MapInfo) {
    currentMap = map;
    let effs = map.effs;
    if (effs) {
        for (let i = 0; i < effs.length; i++) {
            checkAni(effs[i].uri);
        }
    }
    egret.runEgret();
}

let lx: number, ly: number;
function showMap() {
    $engine.enterMap(currentMap as jy.MapInfo);
    view.addEventListener("mousedown", checkDragStart);
    refreshEffectList();
    $engine.invalidate();
    PathSolution.current.onEnterMap(currentMap);
}

let dragStartPt = { x: 0, y: 0 };
let dragState: number;
let dragSt = 0;

function getNow() {
    return Date.now();
}

function mousePt2MapPt(mouseX: number, mouseY: number) {
    let dpr = window.devicePixelRatio;
    let pt = $engine._bg.globalToLocal(mouseX / dpr, mouseY / dpr);
    return pt
}

function checkDragStart(e: MouseEvent) {
    let button = e.button;
    dragState = button;
    dragSt = getNow();
    let flag = true;
    if (button == 2) {
        lx = e.clientX;
        ly = e.clientY;
    } else if (button == 0) {
        if (_effDragging) {
            flag = false;
        } else {
            dragStartPt.x = e.clientX;
            dragStartPt.y = e.clientY;

        }
    }
    if (flag) {
        view.addEventListener("mousemove", dragMove);
        view.addEventListener("mouseup", dragEnd);
    }
}

function dragMove(e: MouseEvent) {
    let { clientX, clientY } = e;
    if (dragState == 2) {
        let dx = lx - clientX;
        let dy = ly - clientY;
        lx = clientX;
        ly = clientY;
        let camera = $engine.camera;
        let rect = camera.rect;
        camera.moveTo(rect.x + rect.width * .5 + dx, rect.y + rect.height * .5 + dy);
    } else if (curCtrl == CtrlName.EffectList && dragState == 0 && !_effDragging) {
        let layer = $engine.getLayer(jy.GameLayerID.TopEffect) as jy.BaseLayer;
        let g = layer.graphics;
        g.clear();
        g.lineStyle(1, 0x00ff00);
        let { x, y } = dragStartPt;
        g.drawRect(x, y, clientX - x, clientY - y);
    }
}

function dragEnd(e: MouseEvent) {
    if (curCtrl == CtrlName.EffectList) {
        if (dragState == 0) { //拉框操作        
            let layer = $engine.getLayer(jy.GameLayerID.TopEffect) as jy.BaseLayer;
            let g = layer.graphics;
            g.clear();

            let { clientX, clientY } = e;
            let { x, y } = dragStartPt;
            let width = clientX - x;
            let height = clientY - y;

            let now = getNow();

            if (now - dragSt > 200 && width * width + height * height >= 100) {
                let pt = $engine._bg.globalToLocal(x, y);
                //计算框选到的效果
                checkSelect(pt.x, pt.y, width, height);
            }
        }
    }
    view.removeEventListener("mousemove", dragMove);
    view.removeEventListener("mouseup", dragEnd);
}

function checkSelect(x: number, y: number, width: number, height: number) {
    let rect = new egret.Rectangle(x, y, width, height);
    const effs = $engine.effs;
    let j = 0;
    for (let i = 0; i < effs.length; i++) {
        const eff = effs[i];
        if (rect.contains(eff.x, eff.y)) {
            eff.select(true);
        } else {
            if (!shiftDown) {
                eff.select(false);
            }
        }
    }
    checkSelection();
}

let checkingSelectionData = false;

function checkSelection() {
    checkingSelectionData = true;
    const effs = $engine.effs;
    for (let i = 0; i < effs.length; i++) {
        const eff = effs[i];
        effListFun(eff.selected ? "selectRow" : "unselectRow", i);
    }

    checkingSelectionData = false;
}



/**
 * 选中特效
 */
function selectEff(idx: number, data: AniDele) {
    if (checkingSelectionData) {
        return
    }

    if (data) {
        //是否按住shift
        if (!shiftDown) {
            const effs = $engine.effs;
            //清理数据
            for (let i = 0; i < effs.length; i++) {
                const eff = effs[i];
                if (idx != i) {
                    eff.select(false);
                }
            }
        }

        if (data.selected) {
            data.select(false);
        } else {
            data.select(true);
            $engine.camera.moveTo(data.x, data.y);
        }
    }
    checkSelection();
}

function refreshEffectList() {
    effListFun({ data: $engine.effs });
}

jy.on(AppEvent.RemoveEffect, e => {
    let dele = e.data;
    $engine.effs.remove(dele);
    refreshEffectList();
})

jy.on(AppEvent.CopyEffect, e => {
    let data = e.data as MapEffData;
    data.x += 50;
    data.y += 50;
    let dele = new AniDele(data);
    $engine.effs.pushOnce(dele);
    refreshEffectList();
});

/**
 * 存储当前地图数据
 */
function saveMap() {
    if (!currentMap) {
        return;
    }
    for (let id in ctrlDict) {
        const ctrl = ctrlDict[id];
        if (ctrl.onSave) {
            ctrl.onSave(currentMap);
        }
    }
    const mapCfgFile = path.join(Core.basePath, currentMap.path, ConstString.MapCfgFileName);

    //将数据写入文件
    let out = currentMap.getSpecObject("path", "ext", "ftype", "pWidth", "pHeight", "maxPicX", "maxPicY") as jy.MapInfo;
    let solution = PathSolution.current;
    out.pathType = solution.type;

    solution.beforeSave(out, currentMap);

    let effDeles: AniDele[] = $engine.effs;
    let len = effDeles.length;
    if (len) {
        let effs = [] as MapEffData[];
        const layers = [jy.GameLayerID.BottomEffect, jy.GameLayerID.CeilEffect, jy.GameLayerID.UnderMap];
        for (let i = 0; i < effDeles.length; i++) {
            let dat = effDeles[i].data;
            dat.layer = layers.indexOf(dat.layerID);
            dat.scaleX = dat.sX * 100 | 0;
            dat.scaleY = dat.sY * 100 | 0;
            effs[i] = dat;
        }
        out.effs = effs;
    }
    let pb = getMapInfoPB(currentMap);
    pb.type = solution.type | 0;
    pb.data = solution.getMapBytes(currentMap);
    let mapBytes = PB.writeTo(pb, jy.MapPBDictKey.MapInfoPB);
    out.mapBytesB64 = egret.Base64Util.encode(mapBytes.buffer);
    fs.writeFileSync(mapCfgFile, JSON.stringify(out));
    log(`存储到[${mapCfgFile}]`);

    solution.afterSave({ map: currentMap, log });


    let endAction = Core.cfg.endAction;
    if (endAction) {
        //执行一下当前目录的提交操作
        if (confirm("请先手动提交文件，以便进行后续操作，如果取消将不进行后续操作")) {
            var http: typeof $http = nodeRequire("http");
            http.get(endAction, res => {
                let chunks: Buffer[] = [];
                res.on("data", chunk => {
                    chunks.push(chunk as Buffer);
                });
                res.on("end", () => {
                    let result = Buffer.concat(chunks).toString("utf8");
                    result = result.replace(/\n/g, "<br/>")
                    log(result);
                })
            })
        }
    }

}

function getMapInfoPB(map: jy.MapInfo) {
    let pb = {} as jy.MapInfoPB;
    pb.extType = +(map.ext == jy.Ext.PNG);
    pb.id = +map.path;
    pb.pHeight = map.pHeight;
    pb.pWidth = map.pWidth;
    pb.width = map.width;
    pb.height = map.height;
    let noPic = map.noPic;
    if (noPic) {
        pb.noPic = new jy.ByteArray(noPic.buffer);
    }
    pb.effs = map.effs as jy.MapEffPB[];
    return pb;
}

const txtLog = $g("txtLog");
function log(msg: string, color = "#000000") {
    txtLog.innerHTML += color ? `<font color="${color}">${msg}</font><br/>` : `${msg}<br/>`;
}
function error(msg: string, err?: Error) {
    let errMsg = "";
    if (err) {
        errMsg = `
<font color="#f00"><b>err:</b></font>
${err.message}
<font color="#f00"><b>stack:</b></font>
${err.stack}`
    }
    log(`<font color="#f00">${msg}</font>${errMsg}`);
    console.error(msg, err);
}
export {
    state,
    view,
    setData
}