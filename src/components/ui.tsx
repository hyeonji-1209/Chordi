import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { C, F } from '@/constants/theme';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[st.card, style]}>{children}</View>;
}

export function ScreenTitle({ children }: { children: React.ReactNode }) {
  return <Text style={st.screenTitle}>{children}</Text>;
}

export function KeyBadge({ k, muted }: { k: string; muted?: boolean }) {
  return (
    <Text style={[st.keyBadge, muted && { backgroundColor: 'transparent', color: C.mut, paddingHorizontal: 0 }]}>
      {k}
    </Text>
  );
}

export function GoldTag({ children }: { children: React.ReactNode }) {
  return <Text style={st.goldTag}>{children}</Text>;
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  style,
  dark,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        st.primaryBtn,
        dark && { backgroundColor: C.ink, shadowOpacity: 0 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {icon}
      <Text style={st.primaryBtnLabel}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  style,
  labelStyle,
}: {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [st.ghostBtn, pressed && { borderColor: C.primary }, style]}
    >
      <Text style={[st.ghostBtnLabel, labelStyle]}>{label}</Text>
    </Pressable>
  );
}

export function Avatar({ name, gold, size = 34 }: { name: string; gold?: boolean; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: gold ? C.goldAvatarBg : C.avatarBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: F.sansBold, fontSize: size * 0.35, color: gold ? C.goldDark : C.primary }}>
        {name.length > 1 ? name[1] : name[0]}
      </Text>
    </View>
  );
}

export function SheetThumb({ w = 44, h = 58 }: { w?: number; h?: number }) {
  return (
    <View style={[st.thumb, { width: w, height: h }]}>
      {[...Array(4)].map((_, i) => (
        <View key={i} style={st.thumbLine} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
  },
  screenTitle: {
    fontFamily: F.serif,
    fontSize: 22,
    color: C.ink,
  },
  keyBadge: {
    fontFamily: F.mono,
    fontWeight: '600',
    fontSize: 11.5,
    backgroundColor: C.primaryTint,
    color: C.primary,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  goldTag: {
    fontSize: 10.5,
    fontFamily: F.sansBold,
    color: C.goldDark,
    backgroundColor: C.goldBg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  primaryBtn: {
    flexDirection: 'row',
    gap: 7,
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryBtnLabel: {
    fontFamily: F.sansBold,
    fontSize: 15,
    color: '#fff',
  },
  ghostBtn: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnLabel: {
    fontFamily: F.sansBold,
    fontSize: 14,
    color: C.ink,
  },
  thumb: {
    borderRadius: 7,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FBFAF7',
    padding: 6,
    justifyContent: 'space-evenly',
  },
  thumbLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: '#F0EDE5',
  },
});
