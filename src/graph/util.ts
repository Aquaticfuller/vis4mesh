import * as d3 from "d3";
import { LineLink, RectNode } from "./common";

const directionY = [0, 0, 1, -1];
const directionX = [1, -1, 0, 0]; // S N E W

const colorScale = d3
  .scaleLinear<string>()
  .domain([0, 0.33, 0.66, 1])
  .range(["#0b4f6c", "#1a936f", "#f6d743", "#d7191c"]);

export function ReverseMapping(
  coord: number[],
  transform: d3.ZoomTransform
): number[] {
  const scale = transform.k;
  const translate_x = transform.x;
  const translate_y = transform.y;

  const x_ = (coord[0] - translate_x) / scale;
  const y_ = (coord[1] - translate_y) / scale;

  return [x_, y_];
}

export function ColorScheme(lv: number): string {
  // [0, 9] maps Blue-Green-Yellow-Red palette
  const t = Math.max(0, Math.min(9, lv)) / 9;
  return colorScale(t);
}

export function GetLinkDst([x, y]: [number, number], direction: number) {
  let dx = x + directionX[direction];
  let dy = y + directionY[direction];
  return `Tile_${dx}_${dy}`;
}

export function DirectionOffset(
  [x, y]: [number, number],
  direction: number,
  offset: number
): [number, number] {
  switch (direction) {
    case 0:
      return [x, y + offset];
    case 1:
      return [x, y - offset];
    case 2:
      return [x + offset, y];
    case 3:
      return [x - offset, y];
  }
  return [0, 0];
}

export function GetLineIdentity(line: LineLink): string {
  let ret = `${line.level}_${line.direction}_${line.start.idx}_${line.start.idy}`;
  if (line.channel !== undefined) {
    ret += `_ch${line.channel}`;
  }
  return ret;
}

export function GetRectIdentity(rect: RectNode): string {
  let ret = `${rect.scale}_${rect.idx}_${rect.idy}`;
  return ret;
}
