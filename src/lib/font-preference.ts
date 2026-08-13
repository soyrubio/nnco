export const FONT_PREFERENCE_STORAGE_KEY = "nnco:font:v1";

export const fontPreferenceOptions = [
  { value: "", label: "Helvetica" },
  { value: "geist", label: "Geist" },
  { value: "poppins", label: "Poppins" },
  { value: "ronzino", label: "Ronzino" },
] as const;

export type StoredFontPreference = Exclude<
  (typeof fontPreferenceOptions)[number]["value"],
  ""
>;

export const storedFontPreferenceValues: readonly StoredFontPreference[] =
  fontPreferenceOptions
    .map((option) => option.value)
    .filter((value): value is StoredFontPreference => value !== "");

export function isStoredFontPreference(
  value: string | null | undefined,
): value is StoredFontPreference {
  return (
    value !== null &&
    value !== undefined &&
    storedFontPreferenceValues.includes(value as StoredFontPreference)
  );
}
