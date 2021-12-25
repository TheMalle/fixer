defmodule Fixer.Parser do
  alias Fixer.Discord.Struct.{
    AllowedMentions,
    Component,
    InteractionCallbackData,
    InteractionResponse
  }

  alias Fixer.Parser.{DiceCode, DiceResult}

  def insert_user_ping(%InteractionResponse{data: data} = response, interaction) do
    user_id =
      interaction
      |> Map.get(:user)
      |> Map.get(:id)

    data =
      data
      |> Map.replace!(:content, "<@#{user_id}>")
      |> Map.replace!(:allowed_mentions, %AllowedMentions{users: [user_id]})

    response
    |> Map.replace!(:data, data)
  end

  def interaction_response(dice_results) do
    embeds = embeds(dice_results)
    components = components(dice_results)

    # TODO: If no embeds generated, construct an error response
    response = %InteractionResponse{
      type: 4,
      data: %InteractionCallbackData{
        embeds: embeds,
        components: components
      }
    }
  end

  defp embeds(dice_results), do: Enum.map(dice_results, &embed/1)

  defp embed(%DiceResult{} = result) do
    %DiceResult{
      result: title,
      raw_dice_code: raw_dice_code,
      dice_code: dice_code,
      expanded_result: expanded_result,
      message: message
    } = result

    title = Map.get(result, :result)

    description = embed_description(message, raw_dice_code, dice_code, expanded_result)

    %Nostrum.Struct.Embed{}
    |> Nostrum.Struct.Embed.put_title(title)
    |> Nostrum.Struct.Embed.put_description(description)
  end

  defp embed_description(message, dice_code, dice_code, expanded_result) do
    "#{message}\n\n" <>
      "#{dice_code}\n" <>
      "#{expanded_result}\n"
  end

  defp embed_description(message, raw_dice_code, dice_code, expanded_result) do
    "#{message}\n\n" <>
      "#{raw_dice_code}\n" <>
      "#{dice_code}\n" <>
      "#{expanded_result}\n"
  end

  defp components(dice_results) do
    # TODO: Implement this
    [
      %Component{
        type: 1,
        components: [
          %Component{
            type: 2,
            label: "Repeat",
            style: 2,
            custom_id: "repeat_roll"
          }
        ]
      }
    ]
  end

  def parse(string) do
    # TODO: get aliases defined to user and game (needs some input to this function)
    alias_opts = %{}

    # TODO: get game adapter for game.validate(dicecode) and game.roll(dicecode)
    game = Fixer.Parser

    string
    |> DiceCode.split()
    |> DiceResult.init()
    |> Enum.map(fn raw_dice_code ->
      # TODO: Apply aliases
      with {:ok, dice_code} = apply_alias(raw_dice_code, alias_opts),
           # TODO: Validate generated dice code
           :ok <- game.validate(dice_code),
           # TODO: Roll the dice with game-based resolution
           {:ok, results} = game.roll(dice_code) do
        results
      end
    end)
  end

  def apply_alias(%DiceResult{raw_dice_code: raw_dice_code} = result, _alias_opts) do
    # TODO: Implement this
    result = Map.replace!(result, :dice_code, raw_dice_code)
    {:ok, result}
  end

  def validate(%DiceResult{} = result) do
    # TODO: This is just a placeholder, it should be defined in each game
    #       (although we do need a default one too)
    :ok
  end

  def roll(%DiceResult{dice_code: dice_code} = result) do
    # TODO: This is just a placeholder, it should be defined in each game
    #       (although we do need a default one too)
    result =
      result
      |> Map.replace!(:expanded_result, "( 4 ) + 5 + ( 1, 7 ) + 1")
      |> Map.replace!(:result, "18")
      |> Map.replace!(:message, "This is just a hardcoded default response")
      |> Map.replace!(:actions, [])

    {:ok, result}
  end
end
