
import { IPrimitivePaneRenderer, IPrimitivePaneView, PrimitivePaneViewZOrder } from 'lightweight-charts';
import { VisualTradingRenderer, OrderRendererData } from './renderer';

export class VisualTradingPaneView implements IPrimitivePaneView {
    private _renderer: VisualTradingRenderer;

    constructor() {
        this._renderer = new VisualTradingRenderer();
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'top';
    }

    renderer(): IPrimitivePaneRenderer {
        return this._renderer;
    }

    update(data: OrderRendererData) {
        this._renderer.update(data);
    }
}
