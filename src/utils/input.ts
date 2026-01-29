// src/utils/input.ts
export const extractText = (e: any) =>
  typeof e === 'string'
    ? e
    : e?.target?.value ?? e?.nativeEvent?.text ?? ''
