import { isFunction, isNumber, isObject } from '@antv/util';
import { Node } from '../types';
import { parseSize, type Size } from './size';

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
    | Size
    | { width: number; height: number }
    | ((d?: T) => Size)
    | undefined,
  resultIsNumber: boolean = true,
): (d: T) => Size {
  if (!value && value !== 0) {
    return (d) => {
      const { size } = d.data || {};
      if (size) {
        if (Array.isArray(size))
          return resultIsNumber ? Math.max(...size) || defaultValue : size;
        if (
          isObject<{ width: number; height: number }>(size) &&
          size.width &&
          size.height
        ) {
          return resultIsNumber
            ? Math.max(size.width, size.height) || defaultValue
            : [size.width, size.height];
        }
        return size;
      }
      return defaultValue;
    };
  }
  if (isFunction(value)) return value;
  if (isNumber(value)) return () => value;
  if (Array.isArray(value)) {
    return () => {
      if (resultIsNumber) return Math.max(...value) || defaultValue;
      return value;
    };
  }
  if (isObject(value) && value.width && value.height) {
    return () => {
      if (resultIsNumber)
        return Math.max(value.width, value.height) || defaultValue;
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
export const formatNodeSizeToNumber = (
  nodeSize: Size | ((node: Node) => Size) | undefined,
  nodeSpacing: number | ((node: Node) => number) | undefined,
  defaultNodeSize: number = 10,
): ((node: Node) => number) => {
  let nodeSizeFunc;
  const nodeSpacingFunc =
    typeof nodeSpacing === 'function' ? nodeSpacing : () => nodeSpacing || 0;

  if (!nodeSize) {
    nodeSizeFunc = (d: Node) => {
      if (d.data?.bboxSize) return d.data?.bboxSize;
      if (d.data?.size) {
        const dataSize = d.data.size;
        if (Array.isArray(dataSize)) return dataSize;
        if (isObject<{ width: number; height: number }>(dataSize))
          return [dataSize.width, dataSize.height];
        return dataSize;
      }
      return defaultNodeSize;
    };
  } else if (Array.isArray(nodeSize)) {
    nodeSizeFunc = (d: Node) => nodeSize;
  } else if (isFunction(nodeSize)) {
    nodeSizeFunc = nodeSize;
  } else {
    nodeSizeFunc = (d: Node) => nodeSize;
  }

  const func = (d: Node) => {
    const nodeSize = nodeSizeFunc(d) as Size;
    const nodeSpacing = nodeSpacingFunc(d);
    return Math.max(...parseSize(nodeSize)) + nodeSpacing;
  };

  return func;
};
