import {
    BitmapCoordinatesRenderingScope,
    CanvasRenderingTarget2D,
} from 'fancy-canvas';
import { IPrimitivePaneRenderer } from 'lightweight-charts';
import { positionsLine } from '../../helpers/dimensions/positions';

// Constants from UserPriceAlerts
const buttonWidth = 21;
const centreLabelHeight = 20;
const centreLabelInlinePadding = 9;
const removeButtonWidth = 26;
const averageWidthPerCharacter = 6; // approximate
const crossViewBoxSize = 10;
const crossPath = new Path2D(
    'M9.35359 1.35359C9.11789 1.11789 8.88219 0.882187 8.64648 0.646484L5.00004 4.29293L1.35359 0.646484C1.11791 0.882212 0.882212 1.11791 0.646484 1.35359L4.29293 5.00004L0.646484 8.64648C0.882336 8.88204 1.11804 9.11774 1.35359 9.35359L5.00004 5.70714L8.64648 9.35359C8.88217 9.11788 9.11788 8.88217 9.35359 8.64649L5.70714 5.00004L9.35359 1.35359Z'
);

export interface OrderRendererData {
    orders: Array<{
        id: string;
        y: number;
        color: string;
        text: string;
        hovered: boolean;
        hoverRemove: boolean; // Mouse over the X button
        lineWidth: number;
        lineStyle: number[];
    }>;
    positions: Array<{
        y: number;
        color: string;
        text: string;
        lineWidth: number;
    }>;
}

export class VisualTradingRenderer implements IPrimitivePaneRenderer {
    private _data: OrderRendererData | null = null;

    update(data: OrderRendererData) {
        this._data = data;
    }

    draw(target: CanvasRenderingTarget2D) {
        target.useBitmapCoordinateSpace(scope => {
            if (!this._data) return;
            const ctx = scope.context;

            // Draw Positions
            this._data.positions.forEach(pos => {
                this._drawLine(ctx, scope, pos.y, pos.color, pos.lineWidth, []);
                this._drawSimpleLabel(ctx, scope, pos.y, pos.color, pos.text);
            });

            // Draw Orders
            this._data.orders.forEach(order => {
                this._drawOrderLine(ctx, scope, order.y, order.color, order.lineWidth);
                // Always show label (TradingView style - not just on hover)
                this._drawOrderLabel(ctx, scope, order);
            });
        });
    }

    private _drawLine(
        ctx: CanvasRenderingContext2D,
        scope: BitmapCoordinatesRenderingScope,
        y: number,
        color: string,
        lineWidth: number,
        lineDash: number[]
    ) {
        ctx.beginPath();
        const yPos = Math.round(y * scope.verticalPixelRatio) + 0.5 * scope.verticalPixelRatio;
        ctx.lineWidth = lineWidth * scope.verticalPixelRatio;
        ctx.strokeStyle = color;
        ctx.setLineDash(lineDash.map(d => d * scope.horizontalPixelRatio));
        ctx.moveTo(0, yPos);
        ctx.lineTo(scope.mediaSize.width * scope.horizontalPixelRatio, yPos);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    private _drawOrderLine(
        ctx: CanvasRenderingContext2D,
        scope: BitmapCoordinatesRenderingScope,
        y: number,
        color: string,
        lineWidth: number
    ) {
        this._drawLine(ctx, scope, y, color, lineWidth, [4, 4]);
    }

    private _drawSimpleLabel(
        ctx: CanvasRenderingContext2D,
        scope: BitmapCoordinatesRenderingScope,
        y: number,
        color: string,
        text: string
    ) {
        // Simple label for positions (can stay as is or be improved)
        ctx.font = `${Math.round(11 * scope.verticalPixelRatio)}px sans-serif`;
        const textWidth = ctx.measureText(text).width;
        const padding = 6 * scope.horizontalPixelRatio;
        const height = 20 * scope.verticalPixelRatio;
        const yPos = Math.round(y * scope.verticalPixelRatio);
        const x = scope.mediaSize.width * scope.horizontalPixelRatio - textWidth - (padding * 2);

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.roundRect(x, yPos - height / 2, textWidth + padding * 2, height, 4 * scope.horizontalPixelRatio);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + padding, yPos);
    }

    private _drawOrderLabel(
        ctx: CanvasRenderingContext2D,
        scope: BitmapCoordinatesRenderingScope,
        order: OrderRendererData['orders'][0]
    ) {
        const textLength = order.text.length;
        const labelWidth = this._calculateLabelWidth(textLength);

        // Position on RIGHT side with padding to avoid price axis overlap
        const paddingRight = 60;
        const xCenter = scope.mediaSize.width - (labelWidth / 2) - paddingRight;

        const labelXDimensions = positionsLine(
            xCenter,
            scope.horizontalPixelRatio,
            labelWidth
        );
        const yDimensions = positionsLine(
            order.y,
            scope.verticalPixelRatio,
            centreLabelHeight
        );

        const radius = 4 * scope.horizontalPixelRatio;

        ctx.save();
        try {
            // Main Body Background
            ctx.beginPath();
            ctx.roundRect(
                labelXDimensions.position,
                yDimensions.position,
                labelXDimensions.length,
                yDimensions.length,
                radius
            );
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            const removeButtonStartX =
                labelXDimensions.position +
                labelXDimensions.length -
                removeButtonWidth * scope.horizontalPixelRatio;

            if (order.hoverRemove) {
                // Hover background for remove button
                ctx.beginPath();
                ctx.roundRect(
                    removeButtonStartX,
                    yDimensions.position,
                    removeButtonWidth * scope.horizontalPixelRatio,
                    yDimensions.length,
                    [0, radius, radius, 0]
                );
                ctx.fillStyle = '#F0F3FA';
                ctx.fill();
            }

            // Button Divider
            ctx.beginPath();
            const dividerDimensions = positionsLine(
                removeButtonStartX / scope.horizontalPixelRatio,
                scope.horizontalPixelRatio,
                1
            );
            ctx.fillStyle = '#E8EAED';
            ctx.fillRect(
                dividerDimensions.position,
                yDimensions.position,
                dividerDimensions.length,
                yDimensions.length
            );

            // Colored border stroke (TradingView style - 2px border matching order color)
            ctx.beginPath();
            ctx.roundRect(
                labelXDimensions.position,
                yDimensions.position,
                labelXDimensions.length,
                yDimensions.length,
                radius
            );
            ctx.strokeStyle = order.color; // Use order color for border
            ctx.lineWidth = 2 * scope.horizontalPixelRatio; // 2px border
            ctx.stroke();

            // Text
            ctx.beginPath();
            ctx.fillStyle = '#131722';
            ctx.textBaseline = 'middle';
            ctx.font = `${Math.round(12 * scope.verticalPixelRatio)}px sans-serif`;
            ctx.fillText(
                order.text,
                labelXDimensions.position +
                centreLabelInlinePadding * scope.horizontalPixelRatio,
                order.y * scope.verticalPixelRatio
            );

            // X Icon
            ctx.beginPath();
            const iconSize = 9;
            ctx.translate(
                removeButtonStartX +
                (scope.horizontalPixelRatio * (removeButtonWidth - iconSize)) / 2,
                (order.y - 5) * scope.verticalPixelRatio
            );
            const scaling =
                (iconSize / crossViewBoxSize) * scope.horizontalPixelRatio;
            ctx.scale(scaling, scaling);
            ctx.fillStyle = '#131722';
            ctx.fill(crossPath, 'evenodd');

        } finally {
            ctx.restore();
        }
    }

    private _calculateLabelWidth(textLength: number) {
        const dynamicPadding = textLength > 25 ? Math.min(25, (textLength - 25) * 1.5) : 3;
        return (
            centreLabelInlinePadding * 2 +
            removeButtonWidth +
            dynamicPadding +
            textLength * averageWidthPerCharacter
        );
    }
}
