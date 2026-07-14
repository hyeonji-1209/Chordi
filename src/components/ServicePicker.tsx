import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, F } from '@/constants/theme';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 예배 요일 + 시간(선택) 입력 */
export function ServicePicker({
  day,
  time,
  onChangeDay,
  onChangeTime,
}: {
  day: number | undefined;
  time: string;
  onChangeDay: (d: number) => void;
  onChangeTime: (t: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={st.label}>예배 요일</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {DAYS.map((name, i) => {
          const active = day === i;
          return (
            <Pressable
              key={name}
              onPress={() => onChangeDay(i)}
              style={[st.dayChip, active && st.dayChipActive]}
            >
              <Text style={[st.dayLabel, active && st.dayLabelActive]}>{name}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={st.label}>예배 시간 (선택)</Text>
      <TextInput
        style={st.timeInput}
        placeholder="예: 19:30"
        placeholderTextColor={C.faint}
        value={time}
        onChangeText={onChangeTime}
        keyboardType="numbers-and-punctuation"
      />
    </View>
  );
}

const st = StyleSheet.create({
  label: { fontFamily: F.sansBold, fontSize: 11.5, color: C.mut },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  dayChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  dayLabel: { fontFamily: F.sansMedium, fontSize: 13, color: C.ink },
  dayLabelActive: { fontFamily: F.sansBold, color: '#fff' },
  timeInput: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontFamily: F.sans,
    fontSize: 14,
    color: C.ink,
    width: 130,
  },
});
