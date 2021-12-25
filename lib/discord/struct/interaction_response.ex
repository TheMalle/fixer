defmodule Fixer.Discord.Struct.InteractionResponse do
  @derive Jason.Encoder
  defstruct [
    :type,
    :data
  ]
end
