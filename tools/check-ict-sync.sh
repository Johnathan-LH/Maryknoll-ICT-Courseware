#!/usr/bin/env bash
# 檢查 Teacher 與 Maryknoll-ICT-Courseware 兩個倉庫的 ICT 課件是否一致。
# 用法：bash tools/check-ict-sync.sh <Teacher 倉庫路徑> <Maryknoll-ICT-Courseware 倉庫路徑>
# 對照表：Maryknoll-ICT-Courseware 倉庫根目錄的 ict-sync.tsv（只存放在這個倉庫）
set -u
T="${1:?請提供 Teacher 倉庫路徑}"
M="${2:?請提供 Maryknoll-ICT-Courseware 倉庫路徑}"
MAP="$M/ict-sync.tsv"
bad=0
tail -n +2 "$MAP" | while IFS=$'\t' read -r a b; do
  [ -z "$a" ] && continue
  if [ ! -f "$T/$a" ]; then echo "✗ Teacher 缺少：$a"; bad=1
  elif [ ! -f "$M/$b" ]; then echo "✗ Maryknoll 缺少：$b"; bad=1
  elif cmp -s "$T/$a" "$M/$b"; then echo "✓ 一致：$a ⇄ $b"
  else echo "✗ 內容不同：$a ⇄ $b"; bad=1
  fi
done
# 對照表以外的 ICT 課件（可能是新上架但未同步）
( cd "$T" && ls ICT/F*/*.htm* 2>/dev/null ) | while read -r f; do
  grep -qF "$f	" "$MAP" || echo "？Teacher 有、對照表沒有：$f"
done
( cd "$M" && ls F*/*.htm* 2>/dev/null ) | while read -r f; do
  grep -qF "	$f" "$MAP" || echo "？Maryknoll 有、對照表沒有：$f"
done
