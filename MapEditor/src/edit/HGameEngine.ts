import GameLayer = junyou.GameLayer;
import { AniDele } from "./AniDele";

class HGameEngine extends junyou.GameEngine {
    /**
     * 游戏场景层
     */
    scene: GameLayer;
    /**
     * 游戏层
     */
    game: GameLayer;

    farH: number;
    farW: number;

    /**
     * 游戏场景实际宽度
     */
    sceneW: number;
    /**
     * 游戏场景实际的高度
     */
    sceneH: number;
    effs: AniDele[] = [];
    _scale = 1;

    /**
     * 实际缩放
     */
    _sc: number;

    noX: boolean;
    noY: boolean;
    protected init() {
        this.initConfigs();
        this.initLayers();
        junyou.Global.addInterval(junyou.CallbackInfo.get(this.render, this));
        this.camera = new junyou.Camera();
        this._stage.on(EgretEvent.RESIZE, this.onResize, this);
        this.scale = 1;
        window.$engine = this;
    }
    private onResize() {
        let { stageWidth, stageHeight } = this._stage;
        let scale = this._sc;
        this.camera.setSize(stageWidth / scale, stageHeight / scale);
        this.resetGamePos();
        //检查大小
        this.checkMap();
        this.onFarCp();
    }
    resetGamePos() {
        let { stageWidth, stageHeight } = this._stage;
        let game = this.game;
        game.anchorOffsetX = game.x = stageWidth >> 1;
        game.anchorOffsetY = game.y = stageHeight >> 1;
    }

    checkMap() {
        let { currentMap } = this;
        if (currentMap) {
            let { width: mw, height: mh } = currentMap;
            let { scene, camera: { rect: { width: rw, height: rh } }, _sc } = this;
            let noX = this.noX = mw < rw;
            if (noX) {
                scene.x = (rw - mw) * _sc * .5;
            }
            let noY = this.noY = mh < rh;
            if (noY) {
                scene.y = (rh - mh) * _sc * .5;
            }
            //地图的实际
            this.sceneW = mw;
            this.sceneH = mh;
        }
    }
    /**
     * 设置游戏场景的缩放
     */
    set scale(value: number) {
        //至少大于.001
        value = Math.max(.001, value);
        if (this._scale != value) {
            this._scale = value;
            let gameScene = this.scene;
            let _dprScale = this._sc = value * dpr;
            gameScene.scaleX = gameScene.scaleY = _dprScale;
            this.onResize();
        }
    }

    get scale() {
        return this._scale;
    }

    set rotation(value: number) {
        this.game.rotation = value;
    }

    get rotation() {
        return this.game.rotation;
    }

    /**
     * 当前地图
     */
    currentMap: junyou.MapInfo;

    /**
     * 地图渲染层
     */
    _bg: junyou.TileMapLayer;

    /**
     * 远景
     */
    protected far: Mini;


    /**
     * 初始化默认添加的层
     */
    protected initLayers() {
        this.game = this.getLayer(junyou.GameLayerID.Game);
        this.scene = this.getLayer(junyou.GameLayerID.GameScene);
        this.getLayer(junyou.GameLayerID.CeilEffect);
        this.getLayer(junyou.GameLayerID.Sorted);
        this.getLayer(junyou.GameLayerID.BottomEffect);
        let bg = this._bg = <junyou.TileMapLayer>this.getLayer(junyou.GameLayerID.Background);
        bg.touchEnabled = true;
        bg.preload = 2;
        let far = this.far = new junyou.Image() as Mini;
        if (DEBUG) {
            far.noWebp = true;
        }
        far.id = 1600;
        far.qid = junyou.Res.ResQueueID.Highway;
    }

    /**
     * 用于做游戏场景特效 
     * 获取基于Game的Texture的点坐标
     */
    getGamePoint(point: junyou.Point, out?: junyou.Point) {
        out = out || {} as junyou.Point;
        let scale = this._scale;
        out.x = point.x * scale;
        out.y = this.game.height - point.y * scale;
        return out;
    }

    protected initConfigs() {
        let addLayerConfig = HGameEngine.addLayerConfig;

        addLayerConfig(junyou.GameLayerID.Game);

        addLayerConfig(junyou.GameLayerID.Mask, junyou.GameLayerID.Game);
        addLayerConfig(junyou.GameLayerID.TopEffect, junyou.GameLayerID.Game);
        addLayerConfig(junyou.GameLayerID.GameScene, junyou.GameLayerID.Game);
        addLayerConfig(junyou.GameLayerID.CeilEffect, junyou.GameLayerID.GameScene);
        addLayerConfig(junyou.GameLayerID.Sorted, junyou.GameLayerID.GameScene, junyou.SortedLayer);
        addLayerConfig(junyou.GameLayerID.BottomEffect, junyou.GameLayerID.GameScene);
        addLayerConfig(junyou.GameLayerID.Background, junyou.GameLayerID.GameScene, junyou.TileMapLayer);
    }

    getFarUri(far: string) {
        return junyou.MapInfo.prefix + "lib/" + far + junyou.Ext.JPG;
    }
    /**
     * 进入新地图
     */
    public enterMap(map: junyou.MapInfo) {
        //先清理场景中的元素
        if (map != this.currentMap) {
            this.clearMap();
            this.currentMap = map;

            let bg = this._bg;
            let g = bg.graphics;
            let { width, height } = map;
            g.beginFill(0, 0);
            g.drawRect(0, 0, width, height);
            g.endFill();
            this._bg.currentMap = map;
            let camera = this.camera;
            camera.setLimits(width, height);
            camera.invalidate();
            this.initMap();
            this.checkMap();
            let far = this.far;
            let farUri = "";
            if (farUri) {
                far.width = far.height = NaN;
                far.once(junyou.EventConst.Texture_Complete, this.onFarCp, this);
                far.source = this.getFarUri(farUri);
                this.game.addChildAt(far, 0);
            } else {
                junyou.removeDisplay(far);
            }
            this._bg.setMini(ConstString.Mini + map.ext);
            //初始化地图特效
            initEff(map.effs, this.effs);
        }
    }

    onFarCp() {
        let far = this.far;
        let tex = far.texture;
        if (tex) {
            let w = tex.textureWidth;
            let h = tex.textureHeight;
            let stage = this._stage;
            //检查图片大小
            let { stageWidth: width, stageHeight: height } = stage;
            //使用保持宽高比的情况下基于短边放大的方法
            let { scale } = junyou.getFixedLayout(width, height, w, h, true);
            w *= scale;
            h *= scale;
            far.width = w;
            far.height = h;
            this.farW = (w - width) / (this.sceneW - width);
            this.farH = (h - height) / (this.sceneH - height);
            this.checkFar(this._viewRect);
        }
    }

    /**
     * 清理地图
     */
    public clearMap() {
        // 清理底图
        this._bg.removeChildren();
        this.farW = this.farH = 0;
    }

    /**
     * 初始化地图
     */
    public initMap() {
        //TODO 加载小地图，渲染到Background层
        this.render();
    }

    /**
     * 渲染
     */
    public render() {
        if (this._sortDirty) {
            for (let sortedLayer of this._sortedLayers) {
                sortedLayer.sort();
            }
            this._sortDirty = false;
        }
        let camera = this.camera;
        let changed = camera.changed;
        let rect = camera.rect;
        let effs = this.effs;
        if (changed) {
            let { scene, noX, noY, _sc } = this;
            if (!noX) {
                scene.x = -rect.x * _sc;
            }
            if (!noY) {
                scene.y = -rect.y * _sc;
            }

            //渲染地图底图
            this._bg.setRect(rect);
            this._viewRect = rect;
            camera.change();
            //检查特效
            this.checkFar(rect);
        }
        let len = effs.length;
        if (len) {
            let now = junyou.Global.now;
            for (let i = 0; i < len; i++) {
                let eff = effs[i];
                eff.onRender(now);
                checkPos(rect, eff);
            }
        }
    }

    invalidate() {
        this.invalidateSort();
        this.camera.invalidate();
        this.render();
    }

    checkFar(rect: egret.Rectangle) {
        let { farW, farH, far } = this;
        let x = 0, y = 0;
        if (farW || farH) {
            if (farW) {
                x = rect.x * farW;
            }
            if (farH) {
                y = rect.y * farH;
            }
        }
        far.x = -x;
        far.y = -y;
    }
}


/**
 * 初始化特效
 * @param effDatas 地图效果数据
 * @param effs 地图特效
 */
function initEff(effDatas: MapEffData[], effs: AniDele[]) {
    let i = 0;
    for (; i < effs.length; i++) {
        const eff = effs[i];
        eff.dispose();
    }
    i = 0;
    if (effDatas) {
        for (; i < effDatas.length; i++) {
            const eff = effDatas[i];
            effs[i] = new AniDele(eff);
        }
    }
    effs.length = i;
}

function checkPos(rect: egret.Rectangle, eff: AniDele) {
    if (rect.contains(eff.x, eff.y)) {
        if (!eff.stage && !eff.disposed) {
            eff.layer.addChild(eff);
        }
    } else {
        junyou.removeDisplay(eff);
    }
}


export {
    HGameEngine,
}