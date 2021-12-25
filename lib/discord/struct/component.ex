defmodule Fixer.Discord.Struct.Component do
  @derive Jason.Encoder
  defstruct [
    :type,
    :custom_id,
    :disabled,
    :style,
    :label,
    :emoji,
    :url,
    :options,
    :placeholder,
    :min_values,
    :max_values,
    :components
  ]
end
