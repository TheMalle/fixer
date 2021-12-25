defmodule Fixer.Parser.DiceCode do
  def split(string) do
    with true <- brackets_exist(string),
         true <- same_bracket_count(string),
         {true, delta} <- matching_brackets(string) do
      delta
      |> split_points()
      |> Enum.map(fn {open_index, close_index} ->
        start_index = open_index + 1
        length = close_index - open_index - 1
        String.slice(string, start_index, length)
      end)
    else
      _ -> [string]
    end
  end

  defp brackets_exist(string) do
    String.contains?(string, "[") and String.contains?(string, "]")
  end

  defp same_bracket_count(string) do
    f =
      string
      |> String.to_charlist()
      |> Enum.frequencies()

    # 91 = [
    # 93 = ]
    Map.get(f, 91) == Map.get(f, 93)
  end

  defp matching_brackets(string) do
    delta =
      string
      |> String.to_charlist()
      |> Enum.map(fn char ->
        case char do
          # [
          91 -> 1
          # ]
          93 -> -1
          _ -> 0
        end
      end)

    matching_brackets =
      Enum.reduce(delta, [0], fn val, acc ->
        prev_val = Enum.at(acc, 0)
        new_val = val + prev_val
        [new_val | acc]
      end)
      |> Enum.min()
      |> Kernel.==(0)

    {matching_brackets, delta}
  end

  defp split_points(delta) do
    {split_points, _} =
      delta
      |> Enum.with_index()
      |> Enum.reduce({[], 0}, fn {value, index}, acc ->
        do_split_points(value, index, acc)
      end)

    Enum.reverse(split_points)
  end

  defp do_split_points(0, _index, {_list, _level} = acc), do: acc
  defp do_split_points(1, _index, {list, level}) when level > 0, do: {list, level + 1}
  defp do_split_points(1, index, {list, level}) when level == 0, do: {[index | list], level + 1}
  defp do_split_points(-1, _index, {list, level}) when level > 1, do: {list, level - 1}

  defp do_split_points(-1, index, {[start_index | list], level}) when level === 1,
    do: {[{start_index, index} | list], level - 1}
end
