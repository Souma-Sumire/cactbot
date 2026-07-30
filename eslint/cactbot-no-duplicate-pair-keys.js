module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow duplicate keys in a trigger pair array',
      category: 'Possible Errors',
      recommended: true,
    },
    schema: [],
    messages: {
      duplicatePairKey: 'Duplicate key "{{key}}" found in pair array.',
    },
  },

  create: (context) => {
    return {
      'Property > ArrayExpression': (node) => {
        const keyNode = node.parent.key;
        if (!keyNode)
          return;
        const keyName = keyNode.type === 'Identifier' ? keyNode.name : keyNode.value;
        if (keyName !== 'pair')
          return;

        const seenKeys = new Set();
        for (const element of node.elements) {
          if (!element || element.type !== 'ObjectExpression')
            continue;

          for (const prop of element.properties) {
            if (!prop || prop.type !== 'Property')
              continue;

            const propKey = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
            if (propKey === 'key') {
              let keyValue = null;
              if (prop.value.type === 'Literal') {
                keyValue = String(prop.value.value);
              } else if (prop.value.type === 'Identifier') {
                keyValue = prop.value.name;
              } else if (prop.value.type === 'TemplateLiteral') {
                keyValue = prop.value.quasis.map((q) => q.value.raw).join('');
              }

              if (keyValue !== null) {
                if (seenKeys.has(keyValue)) {
                  context.report({
                    node: prop,
                    messageId: 'duplicatePairKey',
                    data: {
                      key: keyValue,
                    },
                  });
                } else {
                  seenKeys.add(keyValue);
                }
              }
            }
          }
        }
      },
    };
  },
};
