/**
 * Campo de formulário do Lumen+ — fonte única de aparência e comportamento.
 *
 * POR QUE ESTE COMPONENTE EXISTE
 * ------------------------------
 * O smoke em dispositivo mostrou Login e Criar Conta com inputs visualmente
 * diferentes: translúcido escuro num, pílula branca no outro. A causa não era
 * "estilo divergente" — era que cada tela declarava a própria paleta hardcoded,
 * sem passar pelos tokens do tema. Padronizar só os valores resolveria o
 * sintoma e deixaria a porta aberta para a terceira tela divergir de novo.
 *
 * O tratamento adotado é o do Login (superfície translúcida, borda sutil),
 * agora vindo de `semantic[scheme].input`.
 *
 * ERRO: ACESSÍVEL, NÃO DECORATIVO
 * -------------------------------
 * A mensagem de erro é ligada ao campo por `accessibilityLabel` e o input é
 * marcado com `accessibilityInvalid`, para que leitor de tela anuncie o
 * problema. Pintar a borda de vermelho sem isso deixaria o erro invisível para
 * quem não enxerga a borda.
 */

import React, { forwardRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/theme/ThemeContext';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Rótulo acima do campo. Opcional — sem ele o placeholder faz o papel. */
  label?: string;
  /** Mensagem de erro. Presente = campo em estado de erro. */
  error?: string | null;
  /** Ícone à esquerda (nome do Ionicons). */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Campo de senha: adiciona o olho de mostrar/ocultar. */
  secure?: boolean;
  /** Texto de apoio, exibido quando não há erro. */
  hint?: string;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    icon,
    secure = false,
    hint,
    containerStyle,
    editable = true,
    onFocus,
    onBlur,
    testID,
    ...rest
  },
  ref
) {
  const { t } = useTheme();
  const [focado, setFocado] = useState(false);
  const [revelado, setRevelado] = useState(false);

  const temErro = Boolean(error);
  const desabilitado = editable === false;

  const cores = t.input;

  const fundo = desabilitado
    ? cores.bgDisabled
    : focado
      ? cores.bgFocus
      : cores.bg;

  // Ordem importa: erro vence foco. Um campo focado E inválido precisa
  // continuar sinalizando o erro — é o momento em que o usuário está
  // justamente tentando corrigi-lo.
  const borda = temErro
    ? cores.borderError
    : focado
      ? cores.borderFocus
      : cores.border;

  const corIcone = temErro
    ? cores.borderError
    : focado
      ? cores.iconFocus
      : cores.icon;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={[s.label, { color: cores.placeholder }]}>{label}</Text>
      ) : null}

      <View
        style={[
          s.wrapper,
          {
            backgroundColor: fundo,
            borderColor: borda,
            borderRadius: cores.radius,
            // Erro e foco ganham borda mais espessa para não depender só de cor
            // — daltonismo tornaria a diferença invisível.
            borderWidth: temErro || focado ? 2 : 1,
          },
        ]}
      >
        {icon ? (
          <Ionicons name={icon} size={18} color={corIcone} style={s.icon} />
        ) : null}

        <TextInput
          ref={ref}
          testID={testID}
          style={[
            s.input,
            { color: desabilitado ? cores.textDisabled : cores.text },
          ]}
          placeholderTextColor={cores.placeholder}
          selectionColor={cores.caret}
          cursorColor={cores.caret}
          editable={editable}
          secureTextEntry={secure && !revelado}
          onFocus={(e) => {
            setFocado(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocado(false);
            onBlur?.(e);
          }}
          // O React Native não tem `accessibilityInvalid`. A forma que de fato
          // funciona nos dois sistemas é embutir o erro no rótulo acessível do
          // campo — assim o leitor de tela anuncia o problema ao focar — e
          // marcar a mensagem como `alert` com região viva (abaixo), para que
          // ela seja lida quando aparece.
          accessibilityLabel={(() => {
            const base = label ?? (typeof rest.placeholder === 'string' ? rest.placeholder : undefined);
            if (!base) return undefined;
            return temErro ? `${base}. Erro: ${error}` : base;
          })()}
          {...rest}
        />

        {secure ? (
          <Pressable
            onPress={() => setRevelado((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revelado ? 'Ocultar senha' : 'Mostrar senha'}
            testID={testID ? `${testID}-toggle` : undefined}
          >
            <Ionicons
              name={revelado ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={corIcone}
            />
          </Pressable>
        ) : null}
      </View>

      {temErro ? (
        <Text
          style={[s.mensagem, { color: cores.errorText }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID={testID ? `${testID}-error` : undefined}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text style={[s.mensagem, { color: cores.placeholder }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

const s = StyleSheet.create({
  label: {
    fontFamily: 'Nunito-SemiBold',
    fontSize: 13,
    marginBottom: 6,
    marginLeft: 4,
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    // minHeight garante alvo de toque acessível mesmo sem ícone.
    minHeight: 52,
  },
  icon: {
    // sem margem: o `gap` do wrapper já separa
  },
  input: {
    flex: 1,
    fontFamily: 'Nunito-Regular',
    fontSize: 15,
    paddingVertical: 14,
  },
  mensagem: {
    fontFamily: 'Nunito-Regular',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },
});

export default Input;
