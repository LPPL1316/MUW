import type { StyleTag } from "@shaperoute/shared-types";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { countStyleOpen, fetchStyleShop } from "../api/style";
import { color, font, MIN_TAP_SIZE, radius, space } from "../theme/tokens";
import { SheetModal } from "../ui/SheetModal";
import { Tap } from "../ui/Tap";
import { STORE_NAMES, stylePriceLine, styleShopLabel, styleWords } from "./styleWords";

type Props = {
  tag: StyleTag;
  /** Where the counts and «Shop» are asked; none, and nothing is. */
  apiUrl: string | null;
  onClose: () => void;
  /** The fake fetch and opening of the tests. */
  fetchFn?: typeof fetch;
  openUrl?: (url: string) => Promise<unknown>;
};

/**
 * The sheet of a product of a Style post (TASK-384, ADR-0326): its name and
 * brand, the price with the day it was read (none read in the last 7 days:
 * «See price»), the shop and «Shop», and the two lines the user approved,
 * always: the photo is not the product, and MuW earns on the link. Opening it
 * counts one for the day; «Shop» counts one and opens the page in the
 * phone's browser, never inside the app, so the shop's cookies stay the
 * shop's.
 */
export function StyleProductSheet({
  tag,
  apiUrl,
  onClose,
  fetchFn,
  openUrl = (url) => Linking.openURL(url),
}: Props) {
  const insets = useSafeAreaInsets();
  const words = styleWords();
  const [busy, setBusy] = useState(false);
  // Down first, then gone (TASK-388 C3): the post hears of it once the
  // sheet has slid away, as the app's other sheets.
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);
  useEffect(() => {
    if (apiUrl !== null) {
      void countStyleOpen(apiUrl, tag.id, { fetchFn });
    }
  }, [apiUrl, tag.id, fetchFn]);
  const shop = async () => {
    if (apiUrl === null || busy) {
      return;
    }
    setBusy(true);
    const url = await fetchStyleShop(apiUrl, tag.id, { fetchFn });
    if (url !== null) {
      await openUrl(url).catch(() => {});
    }
    setBusy(false);
  };
  return (
    <SheetModal visible={open} onRequestClose={close} onHidden={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessible={false}
        importantForAccessibility="no"
        testID="style-sheet-backdrop"
      />
      <View
        style={[styles.sheet, { paddingBottom: insets.bottom + space.sm }]}
        testID="style-sheet"
      >
        <Text style={styles.brand}>{tag.brand}</Text>
        <Text style={styles.name} accessibilityRole="header">
          {tag.product_name}
        </Text>
        <Text style={styles.price} testID="style-price">
          {stylePriceLine(tag)} · {STORE_NAMES[tag.retailer]}
        </Text>
        <Text style={styles.line}>{words.photoLine}</Text>
        <Tap
          style={[styles.shop, busy && styles.busy]}
          onPress={() => void shop()}
          disabled={busy || apiUrl === null}
          accessibilityRole="link"
          accessibilityState={{ busy, disabled: busy || apiUrl === null }}
          testID="style-shop"
        >
          <Text style={styles.shopText}>{styleShopLabel(tag.retailer)}</Text>
        </Tap>
        <Text style={styles.line}>{words.linkLine}</Text>
      </View>
    </SheetModal>
  );
}

// As the app's other sheets (`../messages/MessageSheet`).
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    gap: space.sm,
    padding: space.lg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    backgroundColor: color.surface,
  },
  brand: {
    ...font.small,
    color: color.textMuted,
  },
  name: {
    ...font.cardTitle,
    color: color.text,
  },
  price: {
    ...font.body,
    color: color.text,
  },
  line: {
    ...font.small,
    color: color.textMuted,
  },
  // Neutral, as every control but the one that draws the route.
  shop: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  busy: {
    opacity: 0.6,
  },
  shopText: {
    ...font.label,
    color: color.text,
  },
});
