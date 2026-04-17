import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {RootStackParamList} from '../../../app/navigation/router';
import {useTheme} from '../../hooks/useTheme';
import {AppIcon} from './AppIcon';

type TabName = 'meetings' | 'live' | 'network';
type NavProp = StackNavigationProp<RootStackParamList, 'History'>;

interface AppBottomNavProps {
  activeTab: TabName;
}

export function AppBottomNav({activeTab}: AppBottomNavProps): React.JSX.Element {
  const {theme} = useTheme();
  const navigation = useNavigation<NavProp>();

  const handleTabPress = (tab: TabName) => {
    if (tab === activeTab) return;
    if (tab === 'meetings') navigation.navigate('History');
    else if (tab === 'live') navigation.navigate('Meeting');
    else navigation.navigate('Settings');
  };

  return (
    <View style={[styles.bottomNav, {backgroundColor: theme.colors.surface['container-low']}] }>
      {[
        {key: 'meetings' as const, label: 'Meetings', icon: 'history' as const},
        {key: 'live' as const, label: 'Live', icon: 'mic' as const},
        {key: 'network' as const, label: 'Network', icon: 'dns' as const},
      ].map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.navTab,
              {backgroundColor: isActive ? theme.colors.surface.container : 'transparent'},
            ]}
            onPress={() => handleTabPress(tab.key)}
            activeOpacity={0.7}
            accessibilityLabel={tab.label}>
            <AppIcon
              name={tab.icon}
              size={20}
              color={isActive ? theme.colors.primary : theme.colors.text.tertiary}
            />
            <Text
              style={[
                styles.navTabLabel,
                {color: isActive ? theme.colors.primary : theme.colors.text.tertiary},
              ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 69, 84, 0.15)',
  },
  navTab: {
    minWidth: 92,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  navTabLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});

export default AppBottomNav;
