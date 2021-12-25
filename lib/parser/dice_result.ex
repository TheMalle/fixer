defmodule Fixer.Parser.DiceResult do
  alias Fixer.Parser.DiceResult

  defstruct raw_dice_code: "",
            dice_code: "",
            expanded_result: "",
            result: "",
            message: "",
            actions: []

  def init(dice_codes) when is_list(dice_codes), do: Enum.map(dice_codes, &init/1)

  def init(dice_code) when is_binary(dice_code) do
    %DiceResult{
      raw_dice_code: dice_code
    }
  end
end
