import { isFunction, isNumber, isObject } from '@antv/util';
import { Node } from '../types';
import type { Size } from './size';

/**
 * Format value with multiple types into a function returns number.
 * @param defaultValue default value when value is invalid
 * @param value value to be formatted
 * @returns formatted result, a function returns number
 */
export function formatNumberFn<T = unknown>(
  defaultValue: number,
  value: number | ((d?: T) => number) | undefined,
): (d?: T | undefined) => number {
  let resultFunc;
  if (isFunction(value)) {
    resultFunc = value;
  } else if (isNumber(value)) {
    // value is number
    resultFunc = () => value;
  } else {
    // value is not number and function
    resultFunc = () => defaultValue;
  }
  return resultFunc;
}

/**
 * Format size config with multiple types into a function returns number
 * @param defaultValue default value when value is invalid
 * @param value value to be formatted
 * @param resultIsNumber whether returns number
 * @returns formatted result, a function returns number
 */
export function formatSizeFn<T extends Node>(
  defaultValue: number,
  value?:
    | number
    | number[]
    | { width: number; height: number }
    | ((d?: T) => number)
    | undefined,
  resultIsNumber: boolean = true,
): (d: T) => number | number[] {
  if (!value && value !== 0) {
    return (d) => {
      const { size } = d.data || {};
      if (size) {
        if (resultIsNumber) {
          if (Array.isArray(size)) return Math.max(...size);
          if (isObject<{ width: number; height: number }>(size)) {
            return Math.max(size.width, size.height) || defaultValue;
          }
        }
        return size;
      }
      return defaultValue;
    };
  }
  if (isFunction(value)) {
    return value;
  }
  if (isNumber(value)) {
    return () => value;
  }
  if (Array.isArray(value)) {
    return () => {
      if (resultIsNumber) {
        const max = Math.max(...value);
        return isNaN(max) ? defaultValue : max;
      }
      return value;
    };
  }
  if (isObject(value)) {
    return () => {
      if (resultIsNumber) {
        const max = Math.max(value.width, value.height);
        return isNaN(max) ? defaultValue : max;
      }
      return [value.width, value.height];
    };
  }
  return () => defaultValue;
}

/**
 * format the props nodeSize and nodeSpacing to a function
 * @param nodeSize
 * @param nodeSpacing
 * @returns
 */
export const formatNodeSize = (
  nodeSize: Size | ((nodeData: Node) => Size) | undefined,
  nodeSpacing: number | Function | undefined,
): ((nodeData: Node) => Size) => {
  let nodeSizeFunc;
  let nodeSpacingFunc: Function;
  if (isNumber(nodeSpacing)) {
    nodeSpacingFunc = () => nodeSpacing;
  } else if (isFunction(nodeSpacing)) {
    nodeSpacingFunc = nodeSpacing;
  } else {
    nodeSpacingFunc = () => 0;
  }

  if (!nodeSize) {
    nodeSizeFunc = (d: Node) => {
      if (d.data?.bboxSize) {
        return (
          Math.max(d.data.bboxSize[0], d.data.bboxSize[1]) + nodeSpacingFunc(d)
        );
      }
      if (d.data?.size) {
        if (Array.isArray(d.data.size)) {
          return Math.max(d.data.size[0], d.data.size[1]) + nodeSpacingFunc(d);
        }
        const dataSize = d.data.size;
        if (isObject<{ width: number; height: number }>(dataSize)) {
          const res =
            dataSize.width > dataSize.height ? dataSize.width : dataSize.height;
          return res + nodeSpacingFunc(d);
        }
        return dataSize + nodeSpacingFunc(d);
      }
      return 10 + nodeSpacingFunc(d);
    };
  } else if (Array.isArray(nodeSize)) {
    nodeSizeFunc = (d: Node) => {
      const res = nodeSize[0] > nodeSize[1] ? nodeSize[0] : nodeSize[1];
      return res + nodeSpacingFunc(d);
    };
  } else if (isFunction(nodeSize)) {
    nodeSizeFunc = nodeSize as (nodeData: Node) => number;
  } else {
    nodeSizeFunc = (d: Node) => nodeSize + nodeSpacingFunc(d);
  }
  return nodeSizeFunc;
};
