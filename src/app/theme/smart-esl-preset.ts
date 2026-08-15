import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

/**
 * Structural preset for the PrimeNG (Aura) theme.
 *
 * This file only retunes the *shape* tokens of the theme - radii, control
 * padding, list density, table density, button metrics. It deliberately does
 * not touch a single colour token, so the application's approved palette
 * (primary, surface, severity colours) stays exactly as Aura already resolves
 * it today.
 *
 * Overriding tokens here is what keeps `styles/controls.css` small: instead of
 * fighting library CSS with per-component overrides, every PrimeNG control
 * inherits the same measurements from one place.
 *
 * Values mirror the tokens in `src/styles/design-tokens.css`; keep the two in
 * sync when a measurement changes.
 */
export const SmartEslPreset = definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: '0',
      xs: '2px',
      sm: '4px',
      md: '6px',
      lg: '8px',
      xl: '12px',
    },
  },
  semantic: {
    /* ------------------------------------------------------------------
       Form controls - one padding/radius rhythm for input, select,
       multiselect, datepicker, inputnumber, textarea and friends.
       ------------------------------------------------------------------ */
    formField: {
      paddingX: '0.75rem' /* 12px */,
      paddingY: '0.5rem' /* 8px  */,
      borderRadius: '{border.radius.md}' /* 6px  */,
      sm: {
        fontSize: '0.8125rem',
        paddingX: '0.625rem',
        paddingY: '0.375rem',
      },
      lg: {
        fontSize: '0.9375rem',
        paddingX: '0.875rem',
        paddingY: '0.625rem',
      },
      /* A visible but restrained focus ring, built from the primary colour
         the theme already resolves - no new colour is introduced. */
      focusRing: {
        width: '0',
        style: 'none',
        color: 'transparent',
        offset: '0',
        shadow:
          '0 0 0 3px color-mix(in srgb, {primary.color}, transparent 80%)',
      },
    },

    /* ------------------------------------------------------------------
       Option lists - dropdown, multiselect, autocomplete, listbox, menus.
       Compact but comfortable: 7px/12px per option everywhere.
       ------------------------------------------------------------------ */
    list: {
      padding: '0.25rem',
      gap: '2px',
      header: {
        padding: '0.5rem 0.5rem 0.25rem 0.5rem',
      },
      option: {
        padding: '0.4375rem 0.75rem' /* 7px 12px */,
        borderRadius: '{border.radius.sm}',
      },
      optionGroup: {
        padding: '0.375rem 0.75rem',
        fontWeight: '600',
      },
    },

    navigation: {
      list: { padding: '0.25rem', gap: '2px' },
      item: {
        padding: '0.4375rem 0.75rem',
        borderRadius: '{border.radius.sm}',
        gap: '0.5rem',
      },
      submenuLabel: { padding: '0.375rem 0.75rem', fontWeight: '600' },
      submenuIcon: { size: '0.875rem' },
    },

    content: {
      borderRadius: '{border.radius.lg}',
    },

    overlay: {
      select: {
        borderRadius: '{border.radius.lg}',
        shadow:
          '0 10px 24px -8px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.04)',
      },
      popover: {
        borderRadius: '{border.radius.lg}',
        padding: '0.75rem',
        shadow:
          '0 10px 24px -8px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.04)',
      },
      modal: {
        borderRadius: '{border.radius.xl}',
        padding: '1.25rem',
        shadow:
          '0 24px 48px -12px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.04)',
      },
    },
  },

  components: {
    /* Buttons sit one step tighter than form fields (36px vs 40px). */
    button: {
      root: {
        borderRadius: '{border.radius.md}',
        gap: '0.5rem',
        paddingX: '0.875rem' /* 14px */,
        paddingY: '0.4375rem' /* 7px  */,
        iconOnlyWidth: '2rem' /* 32px */,
        sm: {
          fontSize: '0.75rem',
          paddingX: '0.625rem',
          paddingY: '0.3125rem',
          iconOnlyWidth: '1.75rem',
        },
        lg: {
          fontSize: '0.875rem',
          paddingX: '1rem',
          paddingY: '0.5625rem',
          iconOnlyWidth: '2.5rem',
        },
        label: { fontWeight: '600' },
      },
    },

    /* ERP data-grid density. */
    datatable: {
      headerCell: {
        padding: '0.5rem 0.75rem',
        sm: { padding: '0.375rem 0.5rem' },
        lg: { padding: '0.75rem 1rem' },
      },
      bodyCell: {
        padding: '0.5rem 0.75rem',
        sm: { padding: '0.375rem 0.5rem' },
        lg: { padding: '0.75rem 1rem' },
      },
      footerCell: {
        padding: '0.5rem 0.75rem',
        sm: { padding: '0.375rem 0.5rem' },
        lg: { padding: '0.75rem 1rem' },
      },
      header: { padding: '0.75rem 1rem', borderWidth: '0 0 1px 0' },
      footer: { padding: '0.75rem 1rem', borderWidth: '0 0 1px 0' },
    },

    paginator: {
      root: {
        padding: '0.5rem 0.75rem',
        gap: '0.25rem',
      },
      navButton: {
        width: '2rem',
        height: '2rem',
        borderRadius: '{border.radius.md}',
      },
    },

    tag: {
      root: {
        fontSize: '0.6875rem',
        fontWeight: '600',
        padding: '0.1875rem 0.5rem',
        borderRadius: '{border.radius.sm}',
        roundedBorderRadius: '{border.radius.xl}',
      },
      icon: { size: '0.6875rem' },
    },

    tabs: {
      tab: { padding: '0.625rem 1rem' },
    },

    /* Sized here rather than in CSS: PrimeNG puts the dimensions on the
       checkbox root and its inner box together, so they have to move as one or
       the tick drifts out of line with its label. */
    checkbox: {
      root: {
        width: '1.125rem',
        height: '1.125rem',
        borderRadius: '{border.radius.sm}',
      },
      icon: { size: '0.75rem' },
    },

    radiobutton: {
      root: { width: '1.125rem', height: '1.125rem' },
      icon: { size: '0.5rem' },
    },
  },
});
