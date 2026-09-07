import { useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import { fitTextarea } from "./fit-textarea";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows" | "value" | "defaultValue"> & {
  value: string;
};

export function AutoExpandingTextarea({ value, ...props }: Props) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (fieldRef.current) fitTextarea(fieldRef.current);
  }, [value]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    let active = true;
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => {
      // Ignore the height changes caused by fitting the field itself.
      if (width === field.clientWidth) return;
      width = field.clientWidth;
      fitTextarea(field);
    });
    observer.observe(field);
    void field.ownerDocument.fonts.ready.then(() => {
      if (active) fitTextarea(field);
    });

    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  return <textarea {...props} ref={fieldRef} rows={1} value={value} />;
}
