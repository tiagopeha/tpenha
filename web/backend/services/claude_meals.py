"""
Análise de refeições com Claude Vision e texto.
"""
from __future__ import annotations

import json
import re

import anthropic


async def analisar_refeicao(
    description: str,
    image_base64: str | None,
    api_key: str,
) -> dict:
    """
    Usa o Claude para estimar calorias e macros de uma refeição.

    Args:
        description: Descrição textual da refeição.
        image_base64: Imagem em base64 (opcional).
        api_key: Chave da API Anthropic.

    Returns:
        {
            "calories": float,
            "protein_g": float,
            "carbs_g": float,
            "fat_g": float,
            "description_refined": str,
        }
    """
    client = anthropic.Anthropic(api_key=api_key)

    system_prompt = (
        "Você é um nutricionista especializado em análise de refeições. "
        "Analise a refeição descrita e estime com precisão: calorias totais, "
        "proteínas (g), carboidratos (g) e gorduras (g). "
        "Responda APENAS em JSON válido com as chaves: "
        "calories (number), protein_g (number), carbs_g (number), fat_g (number), notes (string). "
        "Use valores realistas para porções típicas brasileiras. "
        "Não inclua texto fora do JSON."
    )

    # Monta o conteúdo da mensagem
    if image_base64:
        # Claude com visão para análise de imagem + texto
        model = "claude-opus-4-7"

        # Remove prefixo data URL se presente
        if "," in image_base64:
            image_data = image_base64.split(",", 1)[1]
            media_type_part = image_base64.split(",")[0]
            if "jpeg" in media_type_part or "jpg" in media_type_part:
                media_type = "image/jpeg"
            elif "png" in media_type_part:
                media_type = "image/png"
            elif "webp" in media_type_part:
                media_type = "image/webp"
            else:
                media_type = "image/jpeg"
        else:
            image_data = image_base64
            media_type = "image/jpeg"

        content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": image_data,
                },
            },
            {
                "type": "text",
                "text": (
                    f"Analise esta refeição. Descrição adicional: {description}\n"
                    "Estime as calorias e macronutrientes e responda em JSON."
                ),
            },
        ]
    else:
        # Apenas texto
        model = "claude-sonnet-4-6"
        content = [
            {
                "type": "text",
                "text": (
                    f"Analise esta refeição e estime suas calorias e macronutrientes:\n"
                    f"{description}\n\n"
                    "Responda em JSON válido."
                ),
            }
        ]

    message = client.messages.create(
        model=model,
        max_tokens=512,
        system=system_prompt,
        messages=[{"role": "user", "content": content}],
    )

    response_text = message.content[0].text.strip()

    # Extrai JSON da resposta (pode ter markdown ```json ... ```)
    json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
    if json_match:
        response_text = json_match.group(0)

    data = json.loads(response_text)

    return {
        "calories": float(data.get("calories", 0)),
        "protein_g": float(data.get("protein_g", 0)),
        "carbs_g": float(data.get("carbs_g", 0)),
        "fat_g": float(data.get("fat_g", 0)),
        "description_refined": str(data.get("notes", description)),
    }
