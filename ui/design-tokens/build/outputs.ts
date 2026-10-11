// Every generated file and its content, for scripts/tokens.ts (write or --check) and tokens.test.ts.
import { colorsCss, componentsCss, scalesCss, tokensCss, typographyCss } from "./css";
import { colorsGtk, componentsGtk, metricsGtk, typographyGtk } from "./gtk";
import { designTokens, type Tokens } from "./model";
import { colorsSwift, componentsSwift, metricsSwift, typographySwift } from "./swift";
import { tokensTs } from "./ts";
import { colorsXaml, metricsXaml, typographyXaml } from "./xaml";

export interface Output {
  /** Path from ui/. */
  path: string;
  content: string;
}

export function tokenOutputs(tokens: Tokens = designTokens): Output[] {
  return [
    { path: "web/src/lib/styles/tokens.css", content: tokensCss() },
    { path: "web/src/lib/styles/scales.css", content: scalesCss(tokens) },
    { path: "web/src/lib/styles/typography.css", content: typographyCss(tokens) },
    { path: "web/src/lib/styles/components.css", content: componentsCss(tokens) },
    { path: "web/src/lib/styles/tokens.ts", content: tokensTs(tokens) },
    { path: "design-tokens/generated/web/colors.css", content: colorsCss(tokens) },
    { path: "design-tokens/generated/macos/GMColors.swift", content: colorsSwift(tokens) },
    { path: "design-tokens/generated/macos/GMMetrics.swift", content: metricsSwift(tokens) },
    { path: "design-tokens/generated/macos/GMComponents.swift", content: componentsSwift(tokens) },
    { path: "design-tokens/generated/macos/GMTypography.swift", content: typographySwift(tokens) },
    { path: "design-tokens/generated/windows/Colors.xaml", content: colorsXaml(tokens) },
    { path: "design-tokens/generated/windows/Metrics.xaml", content: metricsXaml(tokens) },
    { path: "design-tokens/generated/windows/Typography.xaml", content: typographyXaml(tokens) },
    { path: "design-tokens/generated/linux/colors-light.css", content: colorsGtk(tokens, "light") },
    { path: "design-tokens/generated/linux/colors-dark.css", content: colorsGtk(tokens, "dark") },
    { path: "design-tokens/generated/linux/metrics.css", content: metricsGtk(tokens) },
    { path: "design-tokens/generated/linux/typography.css", content: typographyGtk(tokens) },
    { path: "design-tokens/generated/linux/components.css", content: componentsGtk(tokens) },
  ];
}
