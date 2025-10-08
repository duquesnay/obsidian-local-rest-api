# Multi-Tag Operation Enhancement - Architecture

**Date**: 2025-10-08
**Architect**: solution-architect
**Status**: Ready for implementation

## Réponse à la Question

**Question**: "J'ai l'impression qu'on ne peut mettre qu'un tag à la fois. Existe-t-il, ou est-il facile de faire plusieurs tags en un seul appel?"

**Réponse**: ✅ Oui, c'est facile et très bénéfique! L'API actuelle ne supporte qu'un tag à la fois, mais nous pouvons ajouter le support multi-tag avec **zéro breaking change**.

## Solution Recommandée

**Option 4: Support Dual (Header OU Body)** avec sémantique "best-effort"

### Avantages
- ✅ **Zéro breaking change** - Code existant continue de fonctionner
- ✅ **Performance 10x** - 1 seul appel au lieu de N appels
- ✅ **UX améliorée** - Statut détaillé par tag
- ✅ **Compatible MCP** - Le serveur MCP attend déjà un array!

## API Contracts

### Usage Actuel (Inchangé)
```bash
# Un seul tag via header
curl -X PATCH https://localhost:27124/vault/note.md \
  -H "Target-Type: tag" \
  -H "Target: project" \
  -H "Operation: add"
```

### Nouveau: Multiple Tags
```bash
# Plusieurs tags via body JSON
curl -X PATCH https://localhost:27124/vault/note.md \
  -H "Target-Type: tag" \
  -H "Operation: add" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["project", "important", "review"]}'
```

### Réponse Multi-Tag (Nouveau)
```json
{
  "summary": {
    "requested": 3,
    "succeeded": 2,
    "skipped": 1,
    "failed": 0
  },
  "results": [
    {
      "tag": "project",
      "status": "success",
      "message": "Added to frontmatter"
    },
    {
      "tag": "important",
      "status": "success",
      "message": "Added to frontmatter"
    },
    {
      "tag": "review",
      "status": "skipped",
      "message": "Tag already exists in frontmatter"
    }
  ]
}
```

## Comportement "Best-Effort"

### Add Operation
- ✅ Ajoute les nouveaux tags
- ⏭️ **Skip** les tags qui existent déjà (idempotent)
- ❌ **Fail** les tags invalides
- **Résultat**: Opération réussit même avec des skips

### Remove Operation
- ✅ Supprime les tags existants
- ⏭️ **Skip** les tags qui n'existent pas (idempotent)
- ❌ **Fail** les tags invalides
- **Résultat**: Opération réussit même avec des skips

### Exemple: Tags Mixtes
```json
// Request
{
  "tags": ["valid-tag", "invalid tag!", "existing-tag", "new-tag"]
}

// Response
{
  "summary": {
    "requested": 4,
    "succeeded": 2,    // valid-tag, new-tag
    "skipped": 1,      // existing-tag
    "failed": 1        // invalid tag!
  },
  "results": [...]
}
```

## Gain de Performance

### Avant (Actuel)
```bash
# 10 tags = 10 appels API = 20 I/O (10 reads + 10 writes)
for tag in project important review urgent work personal archive todo done draft
do
  curl -X PATCH .../vault/note.md -H "Target: $tag"
done
```

### Après (Nouveau)
```bash
# 10 tags = 1 appel API = 2 I/O (1 read + 1 write)
curl -X PATCH .../vault/note.md \
  -d '{"tags": ["project", "important", "review", "urgent", "work",
                "personal", "archive", "todo", "done", "draft"]}'
```

**Gain**: ~10x réduction des I/O opérations!

## Implementation Plan

### Phase 1: Core Functionality (1-2 jours)
1. ✅ Refactor request parsing - `parseTagOperationRequest()`
2. ✅ Implement batch processing - `processTagOperation()`
3. ✅ Extract helpers - `addSingleTagToFile()`, `removeSingleTagFromFile()`
4. ✅ Update response handling - Support both single/multi format

### Phase 2: Testing (1 jour)
1. ✅ Unit tests - Validation, parsing, deduplication
2. ✅ Integration tests - Backward compat, multi-tag scenarios
3. ✅ Edge cases - Empty arrays, all invalid, mixed results
4. ✅ MCP integration - Verify compatibility

### Phase 3: Documentation (0.5 jour)
1. ✅ OpenAPI updates
2. ✅ API examples
3. ✅ Migration guide

## Cas d'Usage

### Cas 1: Organisation Rapide
```bash
# Organiser une note avec plusieurs dimensions
curl -X PATCH .../vault/meeting-notes.md \
  -d '{"tags": ["meeting", "project-alpha", "2025", "q1", "important"]}'
```

### Cas 2: Nettoyage en Masse
```bash
# Retirer plusieurs tags obsolètes
curl -X PATCH .../vault/old-note.md \
  -H "Operation: remove" \
  -d '{"tags": ["draft", "wip", "todo", "review-needed"]}'
```

### Cas 3: MCP Integration
```typescript
// Le serveur MCP peut maintenant passer tous les tags en un seul appel
mcp__obsidian__manage_file_tags({
  filePath: "note.md",
  operation: "add",
  tags: ["project", "important", "review"]  // Array déjà supporté!
})
```

## Validation & Sécurité

### Limites Recommandées
- **Max tags par requête**: 50 (configurable)
- **Max longueur tag**: 100 caractères
- **Format tag**: `^[a-zA-Z0-9_\-\/]+$` (inchangé)

### Protection DoS
```typescript
// Limite de rate-limiting plus stricte pour batch
if (tags.length > 10) {
  // Apply stricter rate limiting
}
```

## Compatibilité

### Backward Compatibility Matrix

| Type Client | Single Tag (Header) | Multi Tag (Body) | Impact |
|-------------|---------------------|------------------|--------|
| Clients existants | ✅ Marche inchangé | N/A | Aucun breaking change |
| Serveur MCP | ✅ Fallback supporté | ✅ Support natif | Fonctionnalité améliorée |
| Nouveaux clients | ✅ Peut utiliser l'un ou l'autre | ✅ Méthode préférée | Adoption flexible |

### Migration Path
1. **Phase 1**: Déployer le changement (backward compatible)
2. **Phase 2**: Mettre à jour MCP server pour utiliser batch
3. **Phase 3**: Documenter la nouvelle approche
4. **Phase 4**: (Optionnel) Déprécier single-tag dans v5.0

## Estimation

**Total**: 2.5-3.5 jours
- Implementation: 1-2 jours
- Testing: 1 jour
- Documentation: 0.5 jour

**Complexité**: Moyenne
**Risque**: Faible (backward compatible)
**Valeur**: Haute (gain performance + UX)

## Décision

✅ **APPROUVÉ** - Prêt pour implémentation

**Prochaines étapes**:
1. Créer branch `feat/multi-tag-support`
2. Implémenter Phase 1 avec TDD
3. Review par integration-specialist
4. Tests d'intégration avec MCP
5. Documentation et release notes

## Références

- Architecture complète: Voir sortie du solution-architect
- Code actuel: `src/requestHandler.ts` lignes 1523-1700
- Tests: `src/requestHandler.test.ts` lignes 2020+
