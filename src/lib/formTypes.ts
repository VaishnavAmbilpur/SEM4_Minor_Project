export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FillPoint {
  x: number;
  y: number;
}

export type FormFieldMatchStatus = 'matched' | 'missing' | 'needs_review';
export type FormFieldValueSource = 'database' | 'user_input';
export type FillPointSource = 'ai' | 'heuristic';

export interface DetectedFormField {
  detectedLabel: string;
  canonicalKey: string;
  originalFormKey: string;
  isOptional: boolean;
  confidence: number;
  labelBox: BoundingBox;
}

export interface FormFieldMapping extends DetectedFormField {
  fieldId: string;
  fillPoint?: FillPoint;
  fillPointSource?: FillPointSource;
  matchedProfileKey?: string;
  matchCandidates: string[];
  matchStatus: FormFieldMatchStatus;
  value?: string;
  valueSource?: FormFieldValueSource;
}
