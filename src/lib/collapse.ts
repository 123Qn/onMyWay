import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Zero-size style for elements that must stay mounted. Replaces `display: 'none'`, whose
 * toggling triggers a Yoga assertion crash (react-native#52349). Every edge is reset
 * explicitly because Yoga lets a specific edge (marginLeft) beat a shorthand (margin).
 * Pair it with `collapsedA11y(true)` so the element is not focusable or tappable.
 *
 * `gap` on the parent still reserves space for a zero-size child, so cancel it with a
 * negative margin: `{ ...COLLAPSED, marginBottom: -gap }` (column) or `marginRight: -gap` (row).
 */
export const COLLAPSED: ViewStyle = {
  width: 0,
  height: 0,
  minWidth: 0,
  minHeight: 0,
  flexBasis: 0,
  flexGrow: 0,
  flexShrink: 0,
  margin: 0,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  marginHorizontal: 0,
  marginVertical: 0,
  padding: 0,
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
  paddingHorizontal: 0,
  paddingVertical: 0,
  borderWidth: 0,
  overflow: 'hidden',
  opacity: 0,
  pointerEvents: 'none',
};

/** Same style for Text nodes. */
export const COLLAPSED_TEXT = COLLAPSED as TextStyle;

/** Accessibility props that hide a collapsed element from screen readers. */
export function collapsedA11y(hidden: boolean) {
  return {
    accessibilityElementsHidden: hidden,
    importantForAccessibility: hidden ? ('no-hide-descendants' as const) : ('auto' as const),
  };
}
